export type BabyGender = 'boy' | 'girl' | 'star';

/**
 * Common Chinese compound words containing "他" that do NOT refer to the baby.
 * Protected during live speech transcription so words like "其他" or "吉他" stay intact.
 */
const PROTECTED_TA_COMPOUNDS =
  /(其他|其它|他人|他们|她们|吉他|排他|利他|无他|他乡|他日|他山|他国|他处|他年|他物|他用|他杀|他方|维他命)/g;

/**
 * Adapts third-person pronouns ("他" / "她") in real-time voice transcription
 * according to the baby's gender in the profile:
 * - 'girl' => unify "他" -> "她" (excluding protected compound words)
 * - 'boy'  => unify "她" -> "他" (excluding protected compound words)
 * - 'star' / undefined => leave unchanged
 */
export function applyBabyGenderPronoun(text: string, babyGender?: BabyGender): string {
  if (!text || (babyGender !== 'boy' && babyGender !== 'girl')) {
    return text;
  }

  const placeholders: string[] = [];
  const masked = text.replace(PROTECTED_TA_COMPOUNDS, (match) => {
    const idx = placeholders.push(match) - 1;
    return `\uE000${idx}\uE001`;
  });

  const replaced =
    babyGender === 'girl'
      ? masked.replace(/他/g, '她')
      : masked.replace(/她/g, '他');

  return replaced.replace(/\uE000(\d+)\uE001/g, (_, idxStr) => placeholders[Number(idxStr)] ?? '');
}

/**
 * Calls the Vercel Serverless Function (/api/polish) backed by Zhipu AI glm-4-flash
 * to remove spoken filler words, add natural punctuation, and align baby pronouns
 * ("他" / "她") with the baby's profile gender.
 * API key stays strictly on the server (process.env.ZHIPU_API_KEY).
 */
export async function polishDiaryTextViaApi(
  text: string,
  babyGender?: BabyGender
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('请先说出或输入一些日记内容再整理哦');
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 30_000);

  try {
    const resp = await fetch('/api/polish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: trimmed,
        babyGender: babyGender || 'star',
      }),
      signal: controller.signal,
    });

    const rawBody = await resp.text();
    let payload: unknown = null;
    try {
      payload = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      payload = null;
    }

    if (!resp.ok) {
      const serverErr =
        payload &&
        typeof payload === 'object' &&
        typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : `整理失败（HTTP ${resp.status}），请检查网络或 Vercel 环境变量后重试`;
      throw new Error(serverErr);
    }

    if (
      payload &&
      typeof payload === 'object' &&
      typeof (payload as { polishedText?: unknown }).polishedText === 'string' &&
      (payload as { polishedText: string }).polishedText.trim()
    ) {
      return (payload as { polishedText: string }).polishedText.trim();
    }

    return trimmed;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('整理超时了，请稍后再试一次');
    }
    throw err instanceof Error ? err : new Error('整理语气词失败，请稍后重试');
  } finally {
    window.clearTimeout(timeoutId);
  }
}
