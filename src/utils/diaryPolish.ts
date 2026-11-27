/**
 * Calls the Vercel Serverless Function (/api/polish) backed by Zhipu AI glm-4-flash
 * to remove spoken filler words and add natural punctuation while preserving warmth.
 * API key stays strictly on the server (process.env.ZHIPU_API_KEY).
 */
export async function polishDiaryTextViaApi(text: string): Promise<string> {
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
      body: JSON.stringify({ text: trimmed }),
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
