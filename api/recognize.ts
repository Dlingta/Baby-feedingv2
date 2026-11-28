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
  date: string | null;
  time: string;
  type: RecognizedRecordType;
  amountMl: number | null;
  durationMin: number | null;
  count: number | null;
  note: string;
}

function getDefaultReferenceDate(): string {
  // Default to Asia/Shanghai (UTC+8) date string YYYY-MM-DD
  const nowUtc8 = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const y = nowUtc8.getUTCFullYear();
  const m = String(nowUtc8.getUTCMonth() + 1).padStart(2, '0');
  const d = String(nowUtc8.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildRecognitionPrompt(referenceDate: string): string {
  const refYear = referenceDate.slice(0, 4);
  return `请仔细识别图片中保姆手写的纸质宝宝喂养记录，按时间顺序列出所有喂奶和大小便事件。如果同一行同时写了喂奶和大小便，请拆分成两条独立记录。
同时请留意纸面顶部或行首是否写有日期（如“11月25日”、“11.25”、“2026-11-25”等）。当前参考日期为 ${referenceDate}，若纸面只写了月和日未写年份，年份默认按 ${refYear} 补全为 YYYY-MM-DD；若整张纸确实没有写任何日期，date 填 null。
请严格仅返回如下 JSON 数组格式，不要输出任何其他解释文字：
[
  {
    "date": "${referenceDate}", // 若纸面写有日期请转为 YYYY-MM-DD，完全没写日期则填 null
    "time": "08:30",
    "type": "formula", // 枚举值：formula(配方奶) | breast_bottle(瓶喂母乳) | breast_direct(亲喂) | poop(大便) | pee(小便)
    "amountMl": 120,   // 仅配方奶/瓶喂母乳填数字，其余为 null
    "durationMin": null, // 仅亲喂填分钟数，其余为 null
    "count": 1,        // 仅大小便填次数，未写默认 1
    "note": ""         // 可选，记录特殊备注如“吐奶”“偏稀”
  }
]`;
}

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

function formatValidYmd(year: number, month: number, day: number, referenceYear: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 2020 || year > referenceYear + 1) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeDate(raw: unknown, referenceYear: number): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || /^(null|none|unknown|未知|无)$/i.test(trimmed)) return null;

  // YYYY-MM-DD / YYYY.M.D / YYYY/M/D / YYYY年M月D日
  const fullMatch = trimmed.match(/^(20\d{2})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*[日号]?$/);
  if (fullMatch) {
    return formatValidYmd(
      parseInt(fullMatch[1], 10),
      parseInt(fullMatch[2], 10),
      parseInt(fullMatch[3], 10),
      referenceYear
    );
  }

  // M月D日 / M.D / M/D / M-D (infer referenceYear)
  const mdMatch = trimmed.match(/^(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*[日号]?$/);
  if (mdMatch) {
    return formatValidYmd(
      referenceYear,
      parseInt(mdMatch[1], 10),
      parseInt(mdMatch[2], 10),
      referenceYear
    );
  }

  return null;
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

function normalizeRecords(parsed: unknown, referenceYear: number): RecognizedPaperRecord[] {
  const arr = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { records?: unknown }).records)
    ? (parsed as { records: unknown[] }).records
    : null;

  if (!arr) return [];

  const result: RecognizedPaperRecord[] = [];
  let lastSeenDate: string | null = null;

  for (const item of arr.slice(0, 40)) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const rawType = typeof rec.type === 'string' ? rec.type.trim() : '';
    if (!VALID_TYPES.has(rawType as RecognizedRecordType)) continue;
    const type = rawType as RecognizedRecordType;

    const itemDate = normalizeDate(rec.date, referenceYear);
    if (itemDate) {
      lastSeenDate = itemDate;
    }
    const effectiveDate = itemDate ?? lastSeenDate;

    const time = normalizeTime(rec.time);
    const note =
      typeof rec.note === 'string' ? rec.note.trim().slice(0, 80) : '';

    if (type === 'formula' || type === 'breast_bottle') {
      const amountMl = toPositiveNumber(rec.amountMl, 10, 450) ?? (type === 'formula' ? 120 : 100);
      result.push({
        date: effectiveDate,
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
        date: effectiveDate,
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
        date: effectiveDate,
        time,
        type,
        amountMl: null,
        durationMin: null,
        count,
        note,
      });
    }
  }

  // Backfill earlier rows if the date appeared on a later row on the same page
  const firstDetected = result.find((r) => r.date)?.date ?? null;
  if (firstDetected) {
    for (const r of result) {
      if (!r.date) r.date = firstDetected;
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

  // Strictly validate optional referenceDate (YYYY-MM-DD) for inferring missing year on paper
  const rawRefDate = typeof body.referenceDate === 'string' ? body.referenceDate.trim() : '';
  const referenceDate = /^\d{4}-\d{2}-\d{2}$/.test(rawRefDate)
    ? rawRefDate
    : getDefaultReferenceDate();
  const referenceYear = parseInt(referenceDate.slice(0, 4), 10) || new Date().getUTCFullYear();

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
                text: buildRecognitionPrompt(referenceDate),
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

    const records = normalizeRecords(parsed, referenceYear);
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
