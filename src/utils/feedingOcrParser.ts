import { FeedingType } from '../types/planet';

export interface ParsedFeedingDraft {
  id: string;
  selected: boolean;
  time: string;
  type: FeedingType;
  amountMl?: number;
  durationMin?: number;
  breastSide?: 'left' | 'right' | 'both';
  foodName?: string;
  foodAmount?: string;
  note?: string;
  rawLine: string;
}

const SUPPLEMENT_KEYWORDS = [
  '维生素ad',
  '维生素d3',
  '维生素d',
  '维d',
  'ad',
  'd3',
  '益生菌',
  'dha',
  '钙',
  '铁',
  '锌',
  '鱼肝油',
  '营养剂',
  '滴剂',
];

const SOLIDS_KEYWORDS = [
  '辅食',
  '米粉',
  '米糊',
  '果泥',
  '菜泥',
  '肉泥',
  '蛋黄',
  '菠菜',
  '南瓜',
  '胡萝卜',
  '香蕉',
  '苹果',
  '面条',
  '软饭',
  '粥',
  '糊',
  '泥',
];

const BREAST_KEYWORDS = ['母乳', '亲喂', '冻奶', '吸奶', '瓶喂母乳', '左侧', '右侧', '双侧', '左乳', '右乳'];
const FORMULA_KEYWORDS = ['配方奶', '配方', '奶粉', '水奶', '冲奶', '奶瓶', '瓶喂'];

function toHalfWidth(input: string): string {
  return input
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ');
}

function normalizeOcrLine(raw: string): string {
  let line = toHalfWidth(raw).trim();
  // Normalize common OCR punctuation and unit confusions
  line = line
    .replace(/[：；;]/g, ':')
    .replace(/[，、]/g, ' ')
    .replace(/\b(\d{1,3})\s*(?:m[l1iI|]|M[l1iI|]|rn[l1]|毫升)/g, '$1ml')
    .replace(/(\d{1,3})\s*(?:m[l1iI|]|M[l1iI|]|毫升)/g, '$1ml')
    .replace(/(\d{1,2})\s*(?:min|分钟|分(?![钟]))/gi, '$1min')
    .replace(/\s+/g, ' ');
  return line;
}

function formatHHMM(hour: number, minute: number): string | null {
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function adjustHourByPeriod(hour: number, prefix: string): number {
  if (/下午|午后|傍晚|晚上|晚上|pm/i.test(prefix) && hour >= 1 && hour <= 11) {
    return hour + 12;
  }
  if (/凌晨|半夜|am/i.test(prefix) && hour === 12) {
    return 0;
  }
  return hour;
}

interface ExtractedTime {
  time: string;
  strippedLine: string;
}

function extractTimeFromLine(line: string): ExtractedTime | null {
  // 1) "下午3:20" / "07:30" / "7:05" / "08.30"
  const colonMatch = line.match(
    /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜间|am|pm)?\s*([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)\b/i
  );
  if (colonMatch) {
    const rawHour = parseInt(colonMatch[2], 10);
    const min = parseInt(colonMatch[3], 10);
    const hour = adjustHourByPeriod(rawHour, colonMatch[1] || '');
    const formatted = formatHHMM(hour, min);
    if (formatted) {
      return {
        time: formatted,
        strippedLine: line.replace(colonMatch[0], ' ').replace(/\s+/g, ' ').trim(),
      };
    }
  }

  // 2) Chinese spoken time: "7点半", "下午3点20", "14点05分", "8时30分"
  const cnTimeMatch = line.match(
    /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜间)?\s*([01]?\d|2[0-3])\s*[点时]\s*(半|[0-5]?\d)?\s*分?/
  );
  if (cnTimeMatch) {
    const rawHour = parseInt(cnTimeMatch[2], 10);
    const minToken = cnTimeMatch[3];
    const min = minToken === '半' ? 30 : minToken ? parseInt(minToken, 10) : 0;
    const hour = adjustHourByPeriod(rawHour, cnTimeMatch[1] || '');
    const formatted = formatHHMM(hour, min);
    if (formatted) {
      return {
        time: formatted,
        strippedLine: line.replace(cnTimeMatch[0], ' ').replace(/\s+/g, ' ').trim(),
      };
    }
  }

  // 3) 4-digit time at start of line, e.g. "0730 120ml" or "1430 100"
  const compactMatch = line.match(/^\s*([01]\d|2[0-3])([0-5]\d)(?=\s+[^\s])/);
  if (compactMatch) {
    const formatted = formatHHMM(parseInt(compactMatch[1], 10), parseInt(compactMatch[2], 10));
    if (formatted) {
      return {
        time: formatted,
        strippedLine: line.replace(compactMatch[0], ' ').replace(/\s+/g, ' ').trim(),
      };
    }
  }

  return null;
}

/**
 * Splits a line containing multiple timestamps (e.g. 2-column paper log scanned across)
 * into individual candidate segments.
 */
function splitMultiEntryLine(line: string): string[] {
  const timeRegex =
    /(?:凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜间|am|pm)?\s*(?:[01]?\d|2[0-3])\s*[:.]\s*[0-5]\d\b/gi;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = timeRegex.exec(line)) !== null) {
    indices.push(m.index);
  }
  if (indices.length <= 1) return [line];
  const segments: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : line.length;
    const seg = line.slice(start, end).trim();
    if (seg) segments.push(seg);
  }
  return segments;
}

function parseSingleSegment(
  rawSegment: string,
  fallbackTime: string,
  idx: number
): ParsedFeedingDraft | null {
  const normalized = normalizeOcrLine(rawSegment);
  if (!normalized || normalized.length < 2) return null;

  // Skip obvious header or date-only lines
  if (/^(?:日期|时间|喂养记录|奶量|备注|20\d{2}[-./年]\d{1,2}[-./月]\d{1,2}日?)$/.test(normalized)) {
    return null;
  }

  // Remove standalone date prefixes like "11/23" or "11月23日" so day numbers aren't mistaken for ml
  const withoutDate = normalized
    .replace(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}月\d{1,2}[日号]?\b/g, ' ')
    .replace(/\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\b/g, ' ')
    .trim();

  const extractedTime = extractTimeFromLine(withoutDate);
  const time = extractedTime?.time || fallbackTime;
  const rest = extractedTime ? extractedTime.strippedLine : withoutDate;
  const lowerRest = rest.toLowerCase();

  // Check explicit units
  const mlMatch = rest.match(/\b(\d{2,3})\s*ml\b/i) || rest.match(/(\d{2,3})\s*ml/i);
  const ozMatch = rest.match(/(\d+(?:\.\d+)?)\s*(?:oz|盎司)/i);
  const minMatch = rest.match(/(\d{1,2})\s*min\b/i);
  const gramMatch = rest.match(/(\d{1,3})\s*(?:g|克|勺|碗)\b/i);
  const doseMatch = rest.match(/(\d{1,2})\s*(?:粒|滴|袋|包|片|颗)/);

  const hasBreastKw = BREAST_KEYWORDS.some((kw) => lowerRest.includes(kw));
  const hasFormulaKw = FORMULA_KEYWORDS.some((kw) => lowerRest.includes(kw));
  const hasSupplementKw = SUPPLEMENT_KEYWORDS.some((kw) => lowerRest.includes(kw));
  const hasSolidsKw = SOLIDS_KEYWORDS.some((kw) => lowerRest.includes(kw));

  let breastSide: 'left' | 'right' | 'both' = 'both';
  if (/双侧|双边|左右|双/.test(rest)) {
    breastSide = 'both';
  } else if (/左侧|左边|左乳|(?<![a-z])左(?![右])|\bL\b/i.test(rest)) {
    breastSide = 'left';
  } else if (/右侧|右边|右乳|(?<![左])右|\bR\b/i.test(rest)) {
    breastSide = 'right';
  }

  // Case 1: Supplement (AD / D3 / 益生菌)
  if (hasSupplementKw && !mlMatch && !ozMatch) {
    const matchedName =
      SUPPLEMENT_KEYWORDS.find((kw) => lowerRest.includes(kw))?.toUpperCase() || '维生素AD';
    const qty = doseMatch ? doseMatch[1] : '1';
    const unit = doseMatch ? doseMatch[0].replace(/\d+/g, '') : '粒';
    return {
      id: `ocr-${Date.now()}-${idx}`,
      selected: true,
      time,
      type: 'supplement',
      foodName: matchedName === 'AD' ? '维生素AD' : matchedName === 'D3' ? '维生素D3' : matchedName,
      foodAmount: `${qty}${unit}`,
      rawLine: rawSegment.trim(),
    };
  }

  // Case 2: Solids (辅食 / 米糊 / 果泥)
  if (hasSolidsKw && !mlMatch && !ozMatch) {
    const matchedFood = SOLIDS_KEYWORDS.find((kw) => lowerRest.includes(kw)) || '辅食';
    const qty = gramMatch ? gramMatch[1] : '30';
    const unit = gramMatch ? (gramMatch[0].match(/[g克勺碗]/i)?.[0] || 'g') : 'g';
    return {
      id: `ocr-${Date.now()}-${idx}`,
      selected: true,
      time,
      type: 'solids',
      foodName: matchedFood === '辅食' ? '宝宝辅食' : matchedFood,
      foodAmount: `${qty}${unit.toLowerCase() === '克' ? 'g' : unit}`,
      rawLine: rawSegment.trim(),
    };
  }

  // Case 3: Milk volume (explicit ml or oz)
  let amountMl: number | undefined;
  if (mlMatch) {
    const val = parseInt(mlMatch[1], 10);
    if (val >= 10 && val <= 450) amountMl = val;
  } else if (ozMatch) {
    const val = Math.round(parseFloat(ozMatch[1]) * 30);
    if (val >= 10 && val <= 450) amountMl = val;
  }

  // Case 4: Breastfeeding duration (e.g., "09:30 亲喂 左 15分钟")
  let durationMin: number | undefined;
  if (minMatch) {
    const val = parseInt(minMatch[1], 10);
    if (val >= 1 && val <= 90) durationMin = val;
  }

  // Case 5: Implicit milk volume on a paper log row (e.g. "07:30 120" or "08:00 母乳 90" or "14:20 奶 130")
  if (!amountMl && !durationMin && (extractedTime || hasBreastKw || hasFormulaKw || /奶/.test(rest))) {
    // Handle combined "60+60" style notation on paper logs
    const sumMatch = rest.match(/\b(\d{2,3})\s*\+\s*(\d{2,3})\b/);
    if (sumMatch) {
      const total = parseInt(sumMatch[1], 10) + parseInt(sumMatch[2], 10);
      if (total >= 15 && total <= 450) {
        amountMl = total;
      }
    } else {
      const nums = [...rest.matchAll(/\b(\d{2,3})\b/g)]
        .map((m) => parseInt(m[1], 10))
        .filter((n) => n >= 15 && n <= 400);
      if (nums.length > 0) {
        // Pick the most plausible milk volume (prefer multiples of 5 or 10 if multiple numbers exist)
        const preferred = nums.find((n) => n % 5 === 0) ?? nums[0];
        amountMl = preferred;
      }
    }
  }

  if (amountMl) {
    const isBreast = hasBreastKw && !hasFormulaKw;
    return {
      id: `ocr-${Date.now()}-${idx}`,
      selected: true,
      time,
      type: isBreast ? 'breast' : 'formula',
      amountMl,
      breastSide: isBreast ? breastSide : undefined,
      rawLine: rawSegment.trim(),
    };
  }

  if (durationMin && (hasBreastKw || extractedTime)) {
    return {
      id: `ocr-${Date.now()}-${idx}`,
      selected: true,
      time,
      type: 'breast',
      durationMin,
      breastSide,
      rawLine: rawSegment.trim(),
    };
  }

  return null;
}

/**
 * Parses raw OCR text (from a photographed paper feeding notebook, chart, or screenshot)
 * into structured feeding record drafts. Supports both single-entry and multi-line logs.
 */
export function parseFeedingOcrText(
  rawText: string,
  fallbackTime: string
): ParsedFeedingDraft[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const drafts: ParsedFeedingDraft[] = [];
  let seq = 0;

  for (const line of lines) {
    const normalized = normalizeOcrLine(line);
    const segments = splitMultiEntryLine(normalized);
    for (const seg of segments) {
      const parsed = parseSingleSegment(seg, fallbackTime, seq++);
      if (parsed) {
        drafts.push(parsed);
      }
    }
  }

  // Deduplicate accidental identical time+type+amount duplicates on consecutive lines
  const seen = new Set<string>();
  return drafts.filter((item) => {
    const key = `${item.time}|${item.type}|${item.amountMl ?? ''}|${item.durationMin ?? ''}|${item.foodName ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
