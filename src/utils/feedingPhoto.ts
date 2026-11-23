export interface FeedingRecognitionResult {
  recognized: boolean;
  category: 'formula' | 'breast' | 'solids' | 'supplement' | 'unknown';
  amountMl: number | null;
  durationMin: number | null;
  breastSide: 'left' | 'right' | 'both' | 'unknown';
  foodName: string | null;
  foodAmount: string | null;
  detectedTime: string | null;
  confidence: 'high' | 'medium' | 'low';
  summary: string;
  note: string | null;
}

export type FeedingRecognizeResponse =
  | { status: 'ok'; data: FeedingRecognitionResult }
  | { status: 'static_no_backend'; message: string }
  | { status: 'error'; message: string };

export interface ProcessedFeedingPhoto {
  /** Base64 string (without data:... prefix) sent to Gemini Vision API */
  uploadBase64: string;
  uploadMimeType: 'image/jpeg';
  /** Compact JPEG data URL suitable for preview and persisting in localStorage */
  previewDataUrl: string;
  /** Real capture time (HH:mm) parsed from JPEG EXIF DateTimeOriginal if present */
  exifTime: string | null;
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
    // Look for ASCII EXIF timestamp pattern: "YYYY:MM:DD HH:MM:SS"
    let text = '';
    for (let i = 0; i < bytes.length; i++) {
      const c = bytes[i];
      text += c >= 32 && c <= 126 ? String.fromCharCode(c) : ' ';
    }
    const matches = text.match(/\b(20\d{2}):(0[1-9]|1[0-2]):(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d)\b/g);
    if (!matches || matches.length === 0) return null;
    // Prefer the second match if multiple exist (EXIF often stores ModifyDate first, DateTimeOriginal second)
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
 * Loads a real captured/selected File, resizes it cleanly for fast mobile upload,
 * generates a compact thumbnail for local preview/persistence, and reads EXIF time.
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

    const uploadDataUrl = renderToJpeg(img, 1200, 0.84);
    const previewDataUrl = renderToJpeg(img, 480, 0.74);
    const commaIdx = uploadDataUrl.indexOf(',');
    const uploadBase64 = commaIdx >= 0 ? uploadDataUrl.slice(commaIdx + 1) : uploadDataUrl;

    return {
      uploadBase64,
      uploadMimeType: 'image/jpeg',
      previewDataUrl,
      exifTime,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Sends a real captured photo to the server-side Gemini Vision endpoint.
 * Honestly distinguishes static hosting (e.g., GitHub Pages with no /api backend)
 * from real AI responses and transient errors — never fakes recognition results.
 */
export async function recognizeFeedingPhoto(params: {
  imageBase64: string;
  mimeType: string;
  photoTimeHint?: string | null;
}): Promise<FeedingRecognizeResponse> {
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const endpoint = `${apiBase}/api/feeding/recognize`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: params.imageBase64,
        mimeType: params.mimeType,
        photoTimeHint: params.photoTimeHint || undefined,
      }),
    });
  } catch {
    return {
      status: 'error',
      message: '网络请求失败，请检查网络连接后重试，或直接对照照片手动填写。',
    };
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  // Static hosts like GitHub Pages return 404/405 HTML for POST /api/*
  if ((response.status === 404 || response.status === 405) && !isJson) {
    return {
      status: 'static_no_backend',
      message: '照片已载入 · 当前静态网页（如 GitHub Pages）未连接后端 AI 识图服务，请对照照片手动填写',
    };
  }

  if (!isJson) {
    return {
      status: 'error',
      message: `识图服务返回异常响应（HTTP ${response.status}），请稍后重试或手动填写。`,
    };
  }

  const payload = (await response.json()) as Partial<FeedingRecognitionResult> & {
    error?: string;
    code?: string;
  };

  if (!response.ok) {
    return {
      status: 'error',
      message: payload.error || `照片识别失败（HTTP ${response.status}），请重试或手动填写。`,
    };
  }

  return {
    status: 'ok',
    data: {
      recognized: Boolean(payload.recognized),
      category: payload.category ?? 'unknown',
      amountMl: typeof payload.amountMl === 'number' ? payload.amountMl : null,
      durationMin: typeof payload.durationMin === 'number' ? payload.durationMin : null,
      breastSide: payload.breastSide ?? 'unknown',
      foodName: payload.foodName ?? null,
      foodAmount: payload.foodAmount ?? null,
      detectedTime: payload.detectedTime ?? null,
      confidence: payload.confidence ?? 'low',
      summary: payload.summary || '已完成照片识别，请核对下方数据',
      note: payload.note ?? null,
    },
  };
}
