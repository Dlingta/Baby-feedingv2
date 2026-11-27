import { FeedingRecord } from '../types/planet';

export type PaperLogItemType =
  | 'formula'       // 配方奶
  | 'breast_bottle' // 瓶喂母乳
  | 'breast_direct' // 亲喂
  | 'poop'          // 大便
  | 'pee';          // 小便

export interface PaperLogDraft {
  id: string;
  time: string; // HH:mm
  type: PaperLogItemType;
  /** 配方奶/瓶喂母乳 -> ml；亲喂 -> 分钟；大便/小便 -> 次 */
  value: number;
  rawLine?: string;
}

export interface PaperLogTypeMeta {
  type: PaperLogItemType;
  label: string;
  unit: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  badgeClass: string;
  activeChipClass: string;
}

export const PAPER_LOG_TYPE_LIST: PaperLogTypeMeta[] = [
  {
    type: 'formula',
    label: '配方奶',
    unit: 'ml',
    defaultValue: 120,
    min: 10,
    max: 450,
    step: 10,
    badgeClass: 'bg-[#fef3c7] text-[#92400e] border-[#f5d07a]',
    activeChipClass: 'bg-gradient-to-b from-[#fde074] to-[#f4bd36] text-[#182848] border-[#e8a81c]',
  },
  {
    type: 'breast_bottle',
    label: '瓶喂母乳',
    unit: 'ml',
    defaultValue: 100,
    min: 10,
    max: 450,
    step: 10,
    badgeClass: 'bg-[#e0f2fe] text-[#075985] border-[#93c5fd]',
    activeChipClass: 'bg-[#38bdf8] text-white border-[#0284c7]',
  },
  {
    type: 'breast_direct',
    label: '亲喂',
    unit: '分钟',
    defaultValue: 15,
    min: 1,
    max: 90,
    step: 5,
    badgeClass: 'bg-[#fce7f3] text-[#9d174d] border-[#f9a8d4]',
    activeChipClass: 'bg-[#ec4899] text-white border-[#be185d]',
  },
  {
    type: 'poop',
    label: '大便',
    unit: '次',
    defaultValue: 1,
    min: 1,
    max: 15,
    step: 1,
    badgeClass: 'bg-[#f3e5d0] text-[#78350f] border-[#d6b48a]',
    activeChipClass: 'bg-[#b45309] text-white border-[#92400e]',
  },
  {
    type: 'pee',
    label: '小便',
    unit: '次',
    defaultValue: 1,
    min: 1,
    max: 20,
    step: 1,
    badgeClass: 'bg-[#e0f7fa] text-[#0e7490] border-[#67e8f9]',
    activeChipClass: 'bg-[#0891b2] text-white border-[#0e7490]',
  },
];

export const PAPER_LOG_TYPE_MAP: Record<PaperLogItemType, PaperLogTypeMeta> =
  PAPER_LOG_TYPE_LIST.reduce(
    (acc, item) => {
      acc[item.type] = item;
      return acc;
    },
    {} as Record<PaperLogItemType, PaperLogTypeMeta>
  );

export const SAMPLE_PAPER_LOG_TEXT = [
  '8:30 配方120ml 尿1',
  '11:15 亲喂15分钟 大便1次',
  '14:00 母乳100 嘘嘘',
].join('\n');

function toHalfWidth(input: string): string {
  return input
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
    .replace(/[：]/g, ':')
    .replace(/[。．]/g, '.')
    .replace(/[，、；;]/g, ' ');
}

function formatHHMM(hour: number, minute: number): string | null {
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function adjustHourByPeriod(hour: number, period: string): number {
  if (/下午|午后|傍晚|晚上|夜间|pm/i.test(period) && hour >= 1 && hour <= 11) {
    return hour + 12;
  }
  if (/凌晨|半夜|am/i.test(period) && hour === 12) {
    return 0;
  }
  return hour;
}

interface ExtractedTime {
  time: string;
  stripped: string;
}

function extractTime(line: string): ExtractedTime | null {
  // 1) 8:30 / 08:30 / 8.30 / 下午3:20
  const colonOrDot = line.match(
    /(凌晨|早上|早晨|上午|中午|下午|午后|傍晚|晚上|夜间|am|pm)?\s*([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)(?!\d)/i
  );
  if (colonOrDot) {
    const hour = adjustHourByPeriod(parseInt(colonOrDot[2], 10), colonOrDot[1] || '');
    const min = parseInt(colonOrDot[3], 10);
    const formatted = formatHHMM(hour, min);
    if (formatted) {
      return {
        time: formatted,
        stripped: line.replace(colonOrDot[0], ' ').replace(/\s+/g, ' ').trim(),
      };
    }
  }

  // 2) 8点30 / 8点30分 / 8点半 / 8点 / 8时30分
  const cnTime = line.match(
    /(凌晨|早上|早晨|上午|中午|下午|午后|傍晚|晚上|夜间)?\s*([01]?\d|2[0-3])\s*[点时]\s*(半|[0-5]?\d)?\s*分?/
  );
  if (cnTime) {
    const hour = adjustHourByPeriod(parseInt(cnTime[2], 10), cnTime[1] || '');
    const minPart = cnTime[3];
    const min = minPart === '半' ? 30 : minPart ? parseInt(minPart, 10) : 0;
    const formatted = formatHHMM(hour, min);
    if (formatted) {
      return {
        time: formatted,
        stripped: line.replace(cnTime[0], ' ').replace(/\s+/g, ' ').trim(),
      };
    }
  }

  // 3) 行首四位紧凑时间：0830 配方120
  const compact = line.match(/^\s*([01]\d|2[0-3])([0-5]\d)(?=\s+[^\s])/);
  if (compact) {
    const formatted = formatHHMM(parseInt(compact[1], 10), parseInt(compact[2], 10));
    if (formatted) {
      return {
        time: formatted,
        stripped: line.replace(compact[0], ' ').replace(/\s+/g, ' ').trim(),
      };
    }
  }

  return null;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * 纯前端本地正则解析器：将 iOS 实况文本 / 扫描文本获取的保姆纸质记录
 * 解析为结构化的喂养与大小便核对草稿列表。
 * 100% 本地 JavaScript 运行，不调用任何大模型或第三方 OCR 库。
 */
export function parsePaperLogText(rawText: string, fallbackTime: string): PaperLogDraft[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const drafts: PaperLogDraft[] = [];
  let lastTime: string | null = null;
  let seq = 0;
  const batchTs = Date.now();

  for (const rawLine of lines) {
    const normalized = toHalfWidth(rawLine).replace(/\s+/g, ' ').trim();
    if (!normalized) continue;

    // 跳过纯日期/表头行
    if (/^(?:日期|时间|喂养记录|奶量|大小便|备注|20\d{2}[-./年]\d{1,2}[-./月]\d{1,2}[日号]?)$/.test(normalized)) {
      continue;
    }

    // 去掉行内日期前缀（如 11/27、11月27日、2026-11-27），防止误当成奶量
    const withoutDate = normalized
      .replace(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, ' ')
      .replace(/\d{1,2}月\d{1,2}[日号]?/g, ' ')
      .replace(/\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const timeInfo = extractTime(withoutDate);
    const time = timeInfo?.time || lastTime || fallbackTime;
    if (timeInfo?.time) {
      lastTime = timeInfo.time;
    }

    let working = timeInfo ? timeInfo.stripped : withoutDate;
    if (!working) continue;

    // 1. 提取「大便」记录（先提取并剥离，避免次数数字干扰奶量）
    let poopCount: number | null = null;
    const poopRegex =
      /(?:大便|拉屎|便便|臭臭|屎|拉(?:了)?(?=\s*\d|\s*[×xX*]|\s*次|\s|$)|大(?![小概量口])(?=\s*\d|\s*[×xX*]|\s*次|\s|$))(?:\s*[×xX*]?\s*(\d{1,2})\s*次?)?/g;
    working = working
      .replace(poopRegex, (_match, numStr?: string) => {
        const parsed = numStr ? parseInt(numStr, 10) : 1;
        const safeCount = Number.isFinite(parsed) && parsed > 0 ? clamp(parsed, 1, 15) : 1;
        poopCount = (poopCount ?? 0) + safeCount;
        return ' ';
      })
      .replace(/\s+/g, ' ')
      .trim();

    // 2. 提取「小便」记录（先提取并剥离，避免次数数字干扰奶量）
    let peeCount: number | null = null;
    const peeRegex =
      /(?:小便|嘘嘘|尿尿|撒尿|尿|嘘|小(?![时勺口碗])(?=\s*\d|\s*[×xX*]|\s*次|\s|$))(?:\s*[×xX*]?\s*(\d{1,2})\s*次?)?/g;
    working = working
      .replace(peeRegex, (_match, numStr?: string) => {
        const parsed = numStr ? parseInt(numStr, 10) : 1;
        const safeCount = Number.isFinite(parsed) && parsed > 0 ? clamp(parsed, 1, 20) : 1;
        peeCount = (peeCount ?? 0) + safeCount;
        return ' ';
      })
      .replace(/\s+/g, ' ')
      .trim();

    // 3. 提取「喂养」记录（配方奶 / 瓶喂母乳 / 亲喂）
    const hasDirectKw = /(?:亲喂|亲)/.test(working);
    const hasFormulaKw = /(?:配方奶|配方|奶粉|配|粉)/.test(working);
    const hasBottleBreastKw = /(?:瓶喂母乳|母乳|瓶喂|母)/.test(working);

    const mlMatch = working.match(/(\d{2,3})\s*(?:ml|毫升)/i);
    const minMatch = working.match(/(\d{1,2})\s*(?:分钟|分|min|m(?![lL]))/i);

    let feedingDraft: PaperLogDraft | null = null;

    if (hasDirectKw) {
      const kwNumMatch = working.match(/(?:亲喂|亲)[^\d]{0,4}(\d{1,2})/);
      const rawMin = minMatch
        ? parseInt(minMatch[1], 10)
        : kwNumMatch
        ? parseInt(kwNumMatch[1], 10)
        : 15;
      feedingDraft = {
        id: `paper-${batchTs}-${seq++}`,
        time,
        type: 'breast_direct',
        value: clamp(Number.isFinite(rawMin) ? rawMin : 15, 1, 90),
        rawLine,
      };
    } else if (hasFormulaKw) {
      const kwNumMatch = working.match(/(?:配方奶|配方|奶粉|配|粉)[^\d]{0,4}(\d{2,3})/);
      const fallbackNum = working.match(/\b(\d{2,3})\b/);
      const rawMl = mlMatch
        ? parseInt(mlMatch[1], 10)
        : kwNumMatch
        ? parseInt(kwNumMatch[1], 10)
        : fallbackNum
        ? parseInt(fallbackNum[1], 10)
        : 120;
      feedingDraft = {
        id: `paper-${batchTs}-${seq++}`,
        time,
        type: 'formula',
        value: clamp(Number.isFinite(rawMl) ? rawMl : 120, 10, 450),
        rawLine,
      };
    } else if (hasBottleBreastKw) {
      const kwNumMatch = working.match(/(?:瓶喂母乳|母乳|瓶喂|母)[^\d]{0,4}(\d{2,3})/);
      const fallbackNum = working.match(/\b(\d{2,3})\b/);
      const rawMl = mlMatch
        ? parseInt(mlMatch[1], 10)
        : kwNumMatch
        ? parseInt(kwNumMatch[1], 10)
        : fallbackNum
        ? parseInt(fallbackNum[1], 10)
        : 100;
      feedingDraft = {
        id: `paper-${batchTs}-${seq++}`,
        time,
        type: 'breast_bottle',
        value: clamp(Number.isFinite(rawMl) ? rawMl : 100, 10, 450),
        rawLine,
      };
    } else if (mlMatch) {
      feedingDraft = {
        id: `paper-${batchTs}-${seq++}`,
        time,
        type: 'formula',
        value: clamp(parseInt(mlMatch[1], 10), 10, 450),
        rawLine,
      };
    } else if (minMatch) {
      feedingDraft = {
        id: `paper-${batchTs}-${seq++}`,
        time,
        type: 'breast_direct',
        value: clamp(parseInt(minMatch[1], 10), 1, 90),
        rawLine,
      };
    } else if (poopCount === null && peeCount === null && timeInfo) {
      // 无关键词、无大小便但有时间 + 2~3 位数字（如 "08:30 120"）默认按配方奶解析
      const standalone = working.match(/\b(\d{2,3})\b/);
      if (standalone) {
        const val = parseInt(standalone[1], 10);
        if (val >= 15 && val <= 400) {
          feedingDraft = {
            id: `paper-${batchTs}-${seq++}`,
            time,
            type: 'formula',
            value: val,
            rawLine,
          };
        }
      }
    }

    if (feedingDraft) {
      drafts.push(feedingDraft);
    }

    if (poopCount !== null) {
      drafts.push({
        id: `paper-${batchTs}-${seq++}`,
        time,
        type: 'poop',
        value: clamp(poopCount, 1, 15),
        rawLine,
      });
    }

    if (peeCount !== null) {
      drafts.push({
        id: `paper-${batchTs}-${seq++}`,
        time,
        type: 'pee',
        value: clamp(peeCount, 1, 20),
        rawLine,
      });
    }
  }

  return drafts;
}

export function convertPaperDraftsToFeedingRecords(
  drafts: PaperLogDraft[],
  selectedDate: string,
  recorder: string
): FeedingRecord[] {
  const nowTs = Date.now();
  const updatedAt = new Date().toISOString();

  return drafts.map((draft, idx) => {
    const safeTime = /^\d{2}:\d{2}$/.test(draft.time) ? draft.time : '08:00';
    const base = {
      id: `feed-paper-${nowTs}-${idx}`,
      date: selectedDate,
      time: safeTime,
      recorder: recorder || '妈妈',
      updatedAt,
    };

    if (draft.type === 'formula') {
      return {
        ...base,
        type: 'formula',
        amountMl: Math.max(1, Math.round(draft.value || 120)),
        note: '纸质本扫码导入',
      };
    }

    if (draft.type === 'breast_bottle') {
      return {
        ...base,
        type: 'breast',
        amountMl: Math.max(1, Math.round(draft.value || 100)),
        note: '瓶喂母乳 · 纸质本导入',
      };
    }

    if (draft.type === 'breast_direct') {
      return {
        ...base,
        type: 'breast',
        durationMin: Math.max(1, Math.round(draft.value || 15)),
        breastSide: 'both',
        note: '亲喂 · 纸质本导入',
      };
    }

    if (draft.type === 'poop') {
      return {
        ...base,
        type: 'poop',
        count: Math.max(1, Math.round(draft.value || 1)),
        note: '纸质本扫码导入',
      };
    }

    return {
      ...base,
      type: 'pee',
      count: Math.max(1, Math.round(draft.value || 1)),
      note: '纸质本扫码导入',
    };
  });
}
