import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

interface FeedingRecognitionPayload {
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

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : 0;
      const retryable = status === 429 || status === 503 || status === 500;
      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
  throw lastError;
}

function normalizeTimeString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '12mb' }));

  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, aiReady: Boolean(createGeminiClient()) });
  });

  app.post('/api/feeding/recognize', async (req, res) => {
    const body = req.body as {
      imageBase64?: unknown;
      mimeType?: unknown;
      photoTimeHint?: unknown;
    };

    if (typeof body?.imageBase64 !== 'string' || body.imageBase64.trim().length < 32) {
      res.status(400).json({ error: '未收到有效的照片数据，请重新拍照或选择图片。' });
      return;
    }

    const rawMime = typeof body.mimeType === 'string' ? body.mimeType.toLowerCase().trim() : 'image/jpeg';
    const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      res.status(400).json({ error: '不支持的图片格式，请使用常见照片格式（JPG / PNG / WebP）。' });
      return;
    }

    // Reject oversized payloads (> ~8MB base64)
    if (body.imageBase64.length > 11_000_000) {
      res.status(413).json({ error: '照片体积过大，请重试或选择较清晰的单张照片。' });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'API_KEY_MISSING',
        error: '服务端尚未配置 AI 识图密钥，请先在应用密钥设置中配置后再试。',
      });
      return;
    }

    const photoTimeHint = normalizeTimeString(body.photoTimeHint);

    const promptText = [
      '你是一名严谨的婴幼儿喂养记录图像识别助手。请仔细查看用户上传的真实照片，严格根据画面内容提取喂养信息，绝对不要臆造画面中不存在的数据。',
      '',
      '判断规则：',
      '1. 首先判断照片是否确实与宝宝喂养相关（例如：奶瓶及液面刻度、母乳储奶袋/储奶瓶、奶粉罐/冲奶器界面、宝宝辅食/米糊/果泥、维生素AD/D3/益生菌等婴幼儿营养品，或包含喂奶记录文字的手机截图/纸质手写记录）。',
      '2. 如果照片与宝宝喂养完全无关（例如键盘、桌面杂物、风景、人脸自拍、纯黑/严重模糊无法辨认），必须返回 recognized=false、category="unknown"，并在 summary 中诚实说明你实际看到的内容以及未能识别的原因。',
      '3. 如果照片中有奶瓶或储奶袋：请仔细读取液面位置对应的毫升（ml）刻度数值（如果刻度是 oz，请换算成约等于的 ml，1 oz ≈ 30 ml，并在 note 中注明原刻度）。如能辨认是母乳储奶袋/吸奶器/明确标注母乳，category 返回 "breast"；否则普通奶瓶或奶粉返回 "formula"。若画面有奶瓶但完全看不清刻度或空瓶，仍可返回 recognized=true（或 false 若无法判断），并在 note 中提示需要手动核对奶量。',
      '4. 如果照片是辅食（米糊、果泥、菜泥、面条等），category 返回 "solids"，填写 foodName 和估算克数 foodAmount（仅数字字符串，如 "30"）。',
      '5. 如果照片是维生素AD、D3、益生菌、钙铁锌滴剂等营养品，category 返回 "supplement"，填写 foodName 和估算用量 foodAmount（仅数字字符串，如 "1"）。',
      '6. detectedTime 仅当画面中明确出现时间文字（如时钟、截图时间、水印时间、手写时间）时返回 "HH:mm" 格式；画面中没写时间时必须返回空字符串 ""，不要猜测时间。',
      photoTimeHint ? `补充参考：照片拍摄元数据时间为 ${photoTimeHint}（仅作上下文，画面未出现时间时 detectedTime 仍留空）。` : '',
      '7. summary 使用简洁自然的中文（15-36字），准确描述画面中识别到的结果或未识别原因。',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: body.imageBase64 as string,
                },
              },
              { text: promptText },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                recognized: {
                  type: Type.BOOLEAN,
                  description: '照片中是否真实包含婴幼儿喂养相关信息。无关图片必须为 false。',
                },
                category: {
                  type: Type.STRING,
                  description: '喂养类别：formula | breast | solids | supplement | unknown',
                },
                amountMl: {
                  type: Type.NUMBER,
                  description: '识别到的奶量（毫升），未识别到时返回 0。',
                },
                durationMin: {
                  type: Type.NUMBER,
                  description: '若截图中显示亲喂时长（分钟），返回分钟数，否则返回 0。',
                },
                breastSide: {
                  type: Type.STRING,
                  description: '母乳方向：left | right | both | unknown',
                },
                foodName: {
                  type: Type.STRING,
                  description: '辅食或营养品名称，不适用时返回空字符串。',
                },
                foodAmount: {
                  type: Type.STRING,
                  description: '辅食或营养品数量数字字符串（不含单位），不适用时返回空字符串。',
                },
                detectedTime: {
                  type: Type.STRING,
                  description: '画面中明确可见的 HH:mm 时间，未见时间返回空字符串。',
                },
                confidence: {
                  type: Type.STRING,
                  description: '置信度：high | medium | low',
                },
                summary: {
                  type: Type.STRING,
                  description: '简洁中文结果摘要，说明实际识别到的内容或未识别原因。',
                },
                note: {
                  type: Type.STRING,
                  description: '可选中文核对提示或画面细节，没有则返回空字符串。',
                },
              },
              required: ['recognized', 'category', 'confidence', 'summary'],
            },
          },
        }),
      );

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'AI 未返回有效识别结果，请重试。' });
        return;
      }

      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      const validCategories = new Set(['formula', 'breast', 'solids', 'supplement', 'unknown']);
      const validSides = new Set(['left', 'right', 'both', 'unknown']);
      const validConfidence = new Set(['high', 'medium', 'low']);

      const rawCategory = String(parsed.category ?? 'unknown');
      const category = (validCategories.has(rawCategory) ? rawCategory : 'unknown') as FeedingRecognitionPayload['category'];

      const rawSide = String(parsed.breastSide ?? 'unknown');
      const breastSide = (validSides.has(rawSide) ? rawSide : 'unknown') as FeedingRecognitionPayload['breastSide'];

      const rawConfidence = String(parsed.confidence ?? 'low');
      const confidence = (validConfidence.has(rawConfidence) ? rawConfidence : 'low') as FeedingRecognitionPayload['confidence'];

      const rawMl = typeof parsed.amountMl === 'number' && Number.isFinite(parsed.amountMl) ? Math.round(parsed.amountMl) : 0;
      const rawMin = typeof parsed.durationMin === 'number' && Number.isFinite(parsed.durationMin) ? Math.round(parsed.durationMin) : 0;

      const foodNameStr = typeof parsed.foodName === 'string' ? parsed.foodName.trim() : '';
      const foodAmountStr = typeof parsed.foodAmount === 'string' ? parsed.foodAmount.trim().replace(/[^\d.]/g, '') : '';
      const noteStr = typeof parsed.note === 'string' ? parsed.note.trim() : '';
      const summaryStr = typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : parsed.recognized
          ? '已识别照片中的喂养信息，请核对后保存'
          : '未能从照片中识别到喂养信息，请对准奶瓶刻度或辅食重拍';

      const result: FeedingRecognitionPayload = {
        recognized: Boolean(parsed.recognized) && category !== 'unknown',
        category,
        amountMl: rawMl > 0 && rawMl <= 1000 ? rawMl : null,
        durationMin: rawMin > 0 && rawMin <= 180 ? rawMin : null,
        breastSide,
        foodName: foodNameStr || null,
        foodAmount: foodAmountStr || null,
        detectedTime: normalizeTimeString(parsed.detectedTime),
        confidence,
        summary: summaryStr,
        note: noteStr || null,
      };

      res.json(result);
    } catch (err: unknown) {
      console.error('[feeding/recognize] Gemini API error:', err);
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : 500;
      if (status === 400 || status === 403) {
        res.status(status).json({
          error: 'AI 识图服务鉴权失败，请检查服务端密钥配置。',
        });
        return;
      }
      if (status === 429) {
        res.status(429).json({
          error: '当前识别请求较多，请稍后再试。',
        });
        return;
      }
      res.status(502).json({
        error: '照片识别服务暂时不可用，请稍后重试或对照照片手动填写。',
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
