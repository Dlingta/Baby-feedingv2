import { createWorker, OEM, type Worker } from 'tesseract.js';
import { parseFeedingOcrText, type ParsedFeedingDraft } from './feedingOcrParser';

export interface ProcessedFeedingPhoto {
  /** Compact JPEG data URL suitable for local preview and persisting in localStorage */
  previewDataUrl: string;
  /** High-contrast preprocessed PNG data URL optimized for local OCR on paper logs */
  ocrDataUrl: string;
  /** Real capture time (HH:mm) parsed from JPEG EXIF DateTimeOriginal if present */
  exifTime: string | null;
}

export interface LocalOcrResult {
  rawText: string;
  confidence: number;
  drafts: ParsedFeedingDraft[];
}

export interface LocalOcrProgress {
  stage: string;
  percent: number;
}

let cachedWorkerPromise: Promise<Worker> | null = null;
let activeProgressCallback: ((progress: LocalOcrProgress) => void) | null = null;

function mapTesseractStage(status: string): string {
  if (status.includes('loading tesseract core')) return '正在加载本地离线识别引擎…';
  if (status.includes('initializing tesseract')) return '正在初始化本地识别引擎…';
  if (status.includes('loading language')) return '首次加载中英文离线词库…';
  if (status.includes('initializing api')) return '正在准备纸质文字扫描…';
  if (status.includes('recognizing text')) return '正在识别纸质喂养记录…';
  return '正在本地离线分析照片…';
}

function resolveSelfHostedOcrUrl(relativePath: string): string {
  // Always resolves relative to current page (works on root dev server AND GitHub Pages subpaths)
  const baseHref = window.location.href.split('#')[0].split('?')[0];
  const dirHref = baseHref.endsWith('/') ? baseHref : baseHref.slice(0, baseHref.lastIndexOf('/') + 1);
  return new URL(relativePath, dirHref).href;
}

async function getLocalOcrWorker(): Promise<Worker> {
  if (!cachedWorkerPromise) {
    const workerPath = resolveSelfHostedOcrUrl('ocr/worker.min.js');
    const corePath = resolveSelfHostedOcrUrl('ocr/tesseract-core-lstm.wasm.js');
    const langPath = resolveSelfHostedOcrUrl('ocr/tessdata');

    cachedWorkerPromise = createWorker(['chi_sim', 'eng'], OEM.LSTM_ONLY, {
      workerPath,
      corePath,
      langPath,
      workerBlobURL: false,
      logger: (m) => {
        if (!activeProgressCallback || !m?.status) return;
        const pct =
          typeof m.progress === 'number' && Number.isFinite(m.progress)
            ? Math.min(99, Math.max(5, Math.round(m.progress * 100)))
            : 15;
        activeProgressCallback({
          stage: mapTesseractStage(m.status),
          percent: pct,
        });
      },
    }).catch((err) => {
      cachedWorkerPromise = null;
      throw err;
    });
  }
  return cachedWorkerPromise;
}

/**
 * Extracts HH:mm from a JPEG file's EXIF DateTimeOriginal / DateTime tag (if present).
 * Pure client-side binary scan of the first 128 KB; returns null if unavailable.
 */
export async function extractExifTimeFromFile(file: File): Promise<string | null> {
  try {
    const slice = file.slice(0, 131072);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let text = '';
    for (let i = 0; i < bytes.length; i++) {
      const c = bytes[i];
      text += c >= 32 && c <= 126 ? String.fromCharCode(c) : ' ';
    }
    const matches = text.match(
      /\b(20\d{2}):(0[1-9]|1[0-2]):(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d)\b/g
    );
    if (!matches || matches.length === 0) return null;
    const chosen = matches[matches.length > 1 ? 1 : 0];
    const timePart = chosen.split(' ')[1];
    return timePart ? timePart.slice(0, 5) : null;
  } catch {
    return null;
  }
}

function renderToJpeg(img: HTMLImageElement, maxDim: number, quality: number): string {
  const natW = img.naturalWidth || img.width || 1;
  const natH = img.naturalHeight || img.height || 1;
  const scale = Math.min(1, maxDim / Math.max(natW, natH));
  const w = Math.max(1, Math.round(natW * scale));
  const h = Math.max(1, Math.round(natH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('浏览器画布初始化失败');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Enhances photographed paper notebooks for local OCR:
 * removes uneven warm lamp shadows & faint grid lines via fast integral-image background
 * normalization, producing crisp dark ink on a clean white page.
 */
function renderOcrEnhancedPng(img: HTMLImageElement, maxDim = 1600): string {
  const natW = img.naturalWidth || img.width || 1;
  const natH = img.naturalHeight || img.height || 1;
  const scale = Math.min(1, maxDim / Math.max(natW, natH));
  const w = Math.max(1, Math.round(natW * scale));
  const h = Math.max(1, Math.round(natH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('浏览器画布初始化失败');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const n = w * h;
  const gray = new Uint8Array(n);

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    gray[i] = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]);
  }

  // Build integral image for O(1) local window mean (removes uneven shadow gradients)
  const stride = w + 1;
  const integral = new Float64Array(stride * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowSum = 0;
    const gRow = (y - 1) * w;
    const curRow = y * stride;
    const prevRow = (y - 1) * stride;
    for (let x = 1; x <= w; x++) {
      rowSum += gray[gRow + x - 1];
      integral[curRow + x] = integral[prevRow + x] + rowSum;
    }
  }

  const radius = Math.max(14, Math.round(Math.min(w, h) * 0.025));

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h, y + radius + 1);
    const r0 = y0 * stride;
    const r1 = y1 * stride;
    const gRow = y * w;

    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w, x + radius + 1);
      const area = (x1 - x0) * (y1 - y0);
      const localMean =
        (integral[r1 + x1] - integral[r1 + x0] - integral[r0 + x1] + integral[r0 + x0]) / area;

      const pixel = gray[gRow + x];
      // Normalize pixel against local paper brightness; keep soft anti-aliased strokes for LSTM
      const ratio = localMean > 8 ? pixel / localMean : 1;
      let out: number;
      if (ratio >= 0.94) {
        out = 255; // clean white paper & suppress faint grid lines
      } else if (ratio <= 0.62) {
        out = 0; // crisp black ink
      } else {
        out = Math.round(((ratio - 0.62) / (0.94 - 0.62)) * 255);
      }

      const p = (gRow + x) * 4;
      data[p] = out;
      data[p + 1] = out;
      data[p + 2] = out;
      data[p + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Purely local client-side photo processing:
 * generates a compact JPEG thumbnail for preview/localStorage persistence,
 * an illumination-normalized image for local OCR, and reads EXIF capture time.
 */
export async function processFeedingPhotoFile(file: File): Promise<ProcessedFeedingPhoto> {
  const exifTime = await extractExifTimeFromFile(file);
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('无法读取所选照片，请重新拍照或换一张图片'));
      el.src = objectUrl;
    });

    const previewDataUrl = renderToJpeg(img, 640, 0.78);
    const ocrDataUrl = renderOcrEnhancedPng(img, 1600);

    return {
      previewDataUrl,
      ocrDataUrl,
      exifTime,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Runs 100% on-device offline OCR on a photographed paper feeding log:
 * - Inside native iOS App: uses Apple Vision framework (VNRecognizeTextRequest, Neural Engine, ~200ms)
 * - In browser preview: falls back seamlessly to self-hosted Tesseract.js WebAssembly OCR
 * Makes ZERO Gemini API or external cloud calls.
 */
export async function recognizeFeedingPhotoLocally(
  photo: ProcessedFeedingPhoto,
  fallbackTime: string,
  onProgress?: (progress: LocalOcrProgress) => void
): Promise<LocalOcrResult> {
  // 1. iOS 原生 App 下优先调用苹果 Vision 框架（端侧神经网络引擎，速度快、手写中文识别率高）
  const nativeVisionResult = await (async () => {
    const { isNativeIOSApp, visionOcrBridge } = await import('../native/iosBridge');
    if (!isNativeIOSApp()) return null;
    onProgress?.({ stage: '正在使用 Apple Vision 离线识别纸质记录…', percent: 35 });
    return visionOcrBridge.recognizeText(photo.previewDataUrl);
  })();

  if (nativeVisionResult) {
    const rawText = (nativeVisionResult.text || '').trim();
    const drafts = parseFeedingOcrText(rawText, photo.exifTime || fallbackTime);
    onProgress?.({ stage: 'Apple Vision 识别完成', percent: 100 });
    return {
      rawText,
      confidence: nativeVisionResult.confidence,
      drafts,
    };
  }

  // 2. 网页预览环境兜底：本地离线 Tesseract.js WASM 识别
  activeProgressCallback = onProgress || null;
  onProgress?.({ stage: '正在启动本地离线文字识别…', percent: 8 });

  try {
    const worker = await getLocalOcrWorker();
    const { data } = await worker.recognize(photo.ocrDataUrl);
    const rawText = (data.text || '').trim();
    const confidence = typeof data.confidence === 'number' ? Math.round(data.confidence) : 0;
    const drafts = parseFeedingOcrText(rawText, photo.exifTime || fallbackTime);
    onProgress?.({ stage: '本地识别完成', percent: 100 });
    return {
      rawText,
      confidence,
      drafts,
    };
  } finally {
    activeProgressCallback = null;
  }
}
