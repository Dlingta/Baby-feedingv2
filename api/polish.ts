import type { IncomingMessage, ServerResponse } from 'node:http';

const ZHIPU_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_MODEL = 'glm-4-flash';
const MAX_BODY_BYTES = 32 * 1024; // 32 KB
const MAX_TEXT_CHARS = 4000;

const POLISH_SYSTEM_PROMPT = `你是一位细心温和的文字整理助手，负责将一段父母口述的宝宝日常语音转录文本整理通顺。
核心任务：
1. 删除“嗯、啊、呃、哦、那个、就是说、然后呢”等口语语气词和重复的废话。
2. 修正明显的同音错别字。
3. 补全合理的标点符号和自然分段。

严格禁止：
1. 不要过度润色成华丽的散文或书面套话。
2. 不要凭空捏造任何事实、时间或细节。
3. 必须保留父母原汁原味的亲切口语感。

输出要求：直接返回整理后的纯文本，不要带任何解释、前缀或引号。`;

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
    if (Buffer.byteLength(req.body, 'utf-8') > MAX_BODY_BYTES) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    return JSON.parse(req.body) as Record<string, unknown>;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Strips accidental Markdown fences or outer wrapping quotation marks returned by the LLM.
 */
function cleanPolishedText(raw: string): string {
  let cleaned = raw
    .trim()
    .replace(/^```(?:text|txt|markdown)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  if (
    (cleaned.startsWith('“') && cleaned.endsWith('”')) ||
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith('「') && cleaned.endsWith('」'))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
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
      sendJson(res, 413, { error: '日记文本过长，请分段后再试。' });
      return;
    }
    sendJson(res, 400, { error: '请求体 JSON 格式无效。' });
    return;
  }

  const rawText = typeof body.text === 'string' ? body.text.trim() : '';
  if (!rawText) {
    sendJson(res, 400, { error: '请先输入或说出一些日记内容再整理哦。' });
    return;
  }
  if (rawText.length > MAX_TEXT_CHARS) {
    sendJson(res, 400, { error: `单次最多整理 ${MAX_TEXT_CHARS} 字，请分段处理。` });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  try {
    const upstream = await fetch(ZHIPU_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ZHIPU_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: POLISH_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: rawText,
          },
        ],
      }),
      signal: controller.signal,
    });

    const upstreamText = await upstream.text();
    if (!upstream.ok) {
      let friendlyMsg = `文字整理服务暂时返回异常（HTTP ${upstream.status}），请稍后重试。`;
      if (upstream.status === 401 || upstream.status === 403) {
        friendlyMsg = '文字整理服务鉴权失败，请检查 Vercel 环境变量 ZHIPU_API_KEY 是否正确有效。';
      } else if (upstream.status === 429) {
        friendlyMsg = '整理请求过于频繁，请稍等几秒后再试。';
      }
      sendJson(res, 502, { error: friendlyMsg });
      return;
    }

    let upstreamJson: {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    try {
      upstreamJson = JSON.parse(upstreamText);
    } catch {
      sendJson(res, 502, { error: '文字整理服务返回格式异常，请稍后重试。' });
      return;
    }

    const modelText = upstreamJson?.choices?.[0]?.message?.content;
    const polishedText =
      typeof modelText === 'string' && modelText.trim()
        ? cleanPolishedText(modelText)
        : rawText;

    sendJson(res, 200, { polishedText: polishedText || rawText });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      sendJson(res, 504, { error: '整理超时，请检查网络后再试一次。' });
      return;
    }
    sendJson(res, 500, { error: '整理服务请求失败，请稍后再试。' });
  } finally {
    clearTimeout(timeoutId);
  }
}
