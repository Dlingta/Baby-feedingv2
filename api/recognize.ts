import type { IncomingMessage, ServerResponse } from 'node:http';

const ZHIPU_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_MODEL = 'glm-4v-flash';
const MAX_IMAGE_DATA_URL_LENGTH = 6 * 1024 * 1024; // ~4.5 MB binary after base64

const VALID_TYPES = new Set([
  'formula',
  'breast_bottle',
  'breast_direct',
  'poop',
  'pee',
] as const);

type RecognizedRecordType = 'formula' | 'breast_bottle' | 'breast_direct' | 'poop' | 'pee';

export interface RecognizedPaperRecord {
  time: string;
  type: RecognizedRecordType;
  amountMl: number | null;
  durationMin: number | null;
  count: number | null;
  note: string;
}

const RECOGNITION_PROMPT = `请仔细识别图片中保姆手写的纸质宝宝喂养记录，按时间顺序列出所有喂奶和大小便事件。如果同一行同时写了喂奶和大小便，请拆分成两条独立记录。
请严格仅返回如下 JSON 数组格式，不要输出任何其他解释文字：
[
  {
    "time": "08:30",
    "type": "formula", // 枚举值：formula(配方奶) | breast_bottle(瓶喂母乳) | breast_direct(亲喂) | poop(大便) | pee(小便)
    "amountMl": 120,   // 仅配方奶/瓶喂母乳填数字，其余为 null
    "durationMin": null, // 仅亲喂填分钟数，其余为 null
    "count": 1,        // 仅大小便填次数，未写默认 1
    "note": ""         // 可选，记录特殊备注如“吐奶”“偏稀”
  }
]`;

interface VercelLikeRequest extends IncomingMessage {
  body?: unknown;
}

interface VercelLikeResponse extends ServerResponse {
  status?: (code: number) => VercelLikeResponse;
  json?: (body: unknown) => void;
}

function sendJson(res: VercelLikeResponse, statusCode: number, payload: unknown): void {
  res.setHeader('Cache-Control', 'no-store');
  if (typeof res.status === 'function') {
    const statusRes = res.status(statusCode);
    if (typeof statusRes.json === 'function') {
      statusRes.json(payload);
      return;
    }
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: VercelLikeRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as Record<string, unknown>;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > MAX_IMAGE_DATA_URL_LENGTH + 64 * 1024) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Strips Markdown code blocks (```json ... ```) and accidental inline JS comments
 * before parsing the model response into a clean JSON array.
 */
function cleanModelJsonText(rawContent: string): string {
  let cleaned = rawContent
    .trim()
    .replace(/^```(?:json|JSON)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  // Extract the outer JSON array if the model added brief surrounding text
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket >= firstBracket) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }

  // Strip accidental single-line comments outside quoted strings (e.g. // 仅配方奶...)
  cleaned = cleaned.replace(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*/g, (match) =>
    match.startsWith('"') ? match : ''
  );

  // Strip trailing commas before ] or }
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1').trim();

  return cleaned;
}

function normalizeTime(raw: unknown): string {
  if (typeof raw !== 'string') return '08:00';
  const normalized = raw
    .trim()
    .replace(/[：.点时]/g, ':')
    .replace(/分/g, '');
  const match = normalized.match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return '08:00';
  const hh = Math.min(23, Math.max(0, parseInt(match[1], 10) || 0));
  const mm = Math.min(59, Math.max(0, parseInt(match[2], 10) || 0));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function toPositiveNumber(raw: unknown, min: number, max: number): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeRecords(parsed: unknown): RecognizedPaperRecord[] {
  const arr = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { records?: unknown }).records)
    ? (parsed as { records: unknown[] }).records
    : null;

  if (!arr) return [];

  const result: RecognizedPaperRecord[] = [];
  for (const item of arr.slice(0, 40)) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const rawType = typeof rec.type === 'string' ? rec.type.trim() : '';
    if (!VALID_TYPES.has(rawType as RecognizedRecordType)) continue;
    const type = rawType as RecognizedRecordType;

    const time = normalizeTime(rec.time);
    const note =
      typeof rec.note === 'string' ? rec.note.trim().slice(0, 80) : '';

    if (type === 'formula' || type === 'breast_bottle') {
      const amountMl = toPositiveNumber(rec.amountMl, 10, 450) ?? (type === 'formula' ? 120 : 100);
      result.push({
        time,
        type,
        amountMl,
        durationMin: null,
        count: null,
        note,
      });
    } else if (type === 'breast_direct') {
      const durationMin = toPositiveNumber(rec.durationMin, 1, 90) ?? 15;
      result.push({
        time,
        type,
        amountMl: null,
        durationMin,
        count: null,
        note,
      });
    } else {
      const count = toPositiveNumber(rec.count, 1, 20) ?? 1;
      result.push({
        time,
        type,
        amountMl: null,
        durationMin: null,
        count,
        note,
      });
    }
  }

  return result;
}

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: '仅支持 POST 请求' });
    return;
  }

  const apiKey = process.env.ZHIPU_API_KEY?.trim();
  if (!apiKey) {
    sendJson(res, 503, {
      error: '服务端尚未配置 ZHIPU_API_KEY 环境变量，请在 Vercel 项目设置中添加后重新部署。',
    });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
      sendJson(res, 413, { error: '照片体积过大，请重新拍摄更清晰紧凑的画面。' });
      return;
    }
    sendJson(res, 400, { error: '请求体 JSON 格式无效。' });
    return;
  }

  const image = typeof body.image === 'string' ? body.image.trim() : '';
  if (!image || image.length > MAX_IMAGE_DATA_URL_LENGTH) {
    sendJson(res, 400, { error: '缺少有效图片数据或图片超过大小限制。' });
    return;
  }

  // Strictly require inline Base64 image data URL (prevents arbitrary external URL fetching)
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    sendJson(res, 400, { error: '图片格式需为 Base64 JPEG/PNG/WebP 数据。' });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);

  try {
    const upstream = await fetch(ZHIPU_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ZHIPU_MODEL,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: image,
                },
              },
              {
                type: 'text',
                text: RECOGNITION_PROMPT,
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    const upstreamText = await upstream.text();
    if (!upstream.ok) {
      let friendlyMsg = `识图服务暂时返回异常（HTTP ${upstream.status}），请稍后重试。`;
      if (upstream.status === 401 || upstream.status === 403) {
        friendlyMsg = '识图服务鉴权失败，请检查 Vercel 环境变量 ZHIPU_API_KEY 是否正确有效。';
      } else if (upstream.status === 429) {
        friendlyMsg = '识图请求过于频繁，请稍等几秒后再试。';
      }
      sendJson(res, 502, { error: friendlyMsg });
      return;
    }

    const upstreamJson = JSON.parse(upstreamText) as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ type?: string; text?: string }>;
        };
      }>;
    };

    const rawContent = upstreamJson?.choices?.[0]?.message?.content;
    const textContent =
      typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
        ? rawContent
            .map((part) => (typeof part?.text === 'string' ? part.text : ''))
            .join('\n')
        : '';

    if (!textContent.trim()) {
      sendJson(res, 200, []);
      return;
    }

    const cleanedJson = cleanModelJsonText(textContent);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch {
      sendJson(res, 422, {
        error: '识别结果格式解析失败，请调整光线和拍摄角度后重试。',
      });
      return;
    }

    const records = normalizeRecords(parsed);
    sendJson(res, 200, records);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      sendJson(res, 504, { error: '识别超时，请检查网络或重新拍一张清晰照片再试。' });
      return;
    }
    sendJson(res, 500, { error: '识别服务请求失败，请稍后再试。' });
  } finally {
    clearTimeout(timeoutId);
  }
}
