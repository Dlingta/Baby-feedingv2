import { PaperLogDraft, PaperLogItemType } from './paperLogParser';

export interface ProcessedFeedingPhoto {
  /** Compact JPEG data URL suitable for local preview and persisting in localStorage */
  previewDataUrl: string;
  /** Compressed JPEG Base64 (longest edge <= 1280px, quality 0.8) ready for /api/recognize */
  recognizeDataUrl: string;
  /** Real capture time (HH:mm) parsed from JPEG EXIF DateTimeOriginal if present */
  exifTime: string | null;
}

interface ApiRecognizedItem {
  time?: unknown;
  type?: unknown;
  amountMl?: unknown;
  durationMin?: unknown;
  count?: unknown;
  note?: unknown;
}

const VALID_TYPES = new Set<PaperLogItemType>([
  'formula',
  'breast_bottle',
  'breast_direct',
  'poop',
  'pee',
]);

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
 * Compresses a photographed feeding log via Canvas:
 * - recognizeDataUrl: longest side <= 1280px, JPEG quality 0.8 (for /api/recognize)
 * - previewDataUrl: compact 640px JPEG for thumbnail preview and localStorage persistence
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

    const recognizeDataUrl = renderToJpeg(img, 1280, 0.8);
    const previewDataUrl = renderToJpeg(img, 640, 0.78);
    return {
      previewDataUrl,
      recognizeDataUrl,
      exifTime,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function normalizeTimeStr(raw: unknown, fallbackTime: string): string {
  if (typeof raw !== 'string') return fallbackTime;
  const cleaned = raw.trim().replace(/[：.点时]/g, ':').replace(/分/g, '');
  const m = cleaned.match(/^(\d{1,2}):(\d{1,2})/);
  if (!m) return fallbackTime;
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10) || 0));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10) || 0));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function toSafeNum(raw: unknown, fallback: number, min: number, max: number): number {
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

/**
 * Calls the Vercel Serverless Function (/api/recognize) with the compressed JPEG Base64 image.
 * API key stays strictly on the server (process.env.ZHIPU_API_KEY).
 */
export async function recognizeFeedingPhotoViaApi(
  recognizeDataUrl: string,
  fallbackTime: string
): Promise<PaperLogDraft[]> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 50_000);

  try {
    const resp = await fetch('/api/recognize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: recognizeDataUrl }),
      signal: controller.signal,
    });

    const rawText = await resp.text();
    let payload: unknown = null;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = null;
    }

    if (!resp.ok) {
      const serverErr =
        payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : `识别请求失败（HTTP ${resp.status}），请检查 Vercel 环境变量 ZHIPU_API_KEY 或网络后重试`;
      throw new Error(serverErr);
    }

    const list: ApiRecognizedItem[] = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as { records?: unknown }).records)
      ? ((payload as { records: ApiRecognizedItem[] }).records)
      : [];

    const batchTs = Date.now();
    const drafts: PaperLogDraft[] = [];

    list.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const rawType = typeof item.type === 'string' ? item.type.trim() : '';
      if (!VALID_TYPES.has(rawType as PaperLogItemType)) return;
      const type = rawType as PaperLogItemType;
      const time = normalizeTimeStr(item.time, fallbackTime);
      const note = typeof item.note === 'string' ? item.note.trim().slice(0, 80) : '';

      let value = 1;
      if (type === 'formula') {
        value = toSafeNum(item.amountMl, 120, 10, 450);
      } else if (type === 'breast_bottle') {
        value = toSafeNum(item.amountMl, 100, 10, 450);
      } else if (type === 'breast_direct') {
        value = toSafeNum(item.durationMin, 15, 1, 90);
      } else {
        value = toSafeNum(item.count, 1, 1, 20);
      }

      drafts.push({
        id: `ai-paper-${batchTs}-${idx}`,
        time,
        type,
        value,
        note,
      });
    });

    return drafts;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('识别超时了，请检查网络或重新拍一张清晰一点的照片');
    }
    throw err instanceof Error ? err : new Error('拍照识别失败，请稍后重试');
  } finally {
    window.clearTimeout(timeoutId);
  }
}
