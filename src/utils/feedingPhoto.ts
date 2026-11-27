export interface ProcessedFeedingPhoto {
  /** Compact JPEG data URL suitable for local preview and persisting in localStorage */
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
 * Pure client-side photo compression for optional feeding record photo attachment.
 * Zero OCR libraries, zero external API calls.
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
    return {
      previewDataUrl,
      exifTime,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
