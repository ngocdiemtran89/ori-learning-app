// ============================================================
// Phase P3.5I Hotfix: Auto-Detecting Script & Bilingual Content Parser
// Supports JSON, CSV, and Plain Text / Human Format with Vietnamese Headings
// ============================================================

export interface ParsedScriptItem {
  targetType: 'question' | 'group';
  number?: number;
  startQuestion?: number;
  endQuestion?: number;
  range?: string;
  part?: string;
  question_text?: string;
  translation_vi?: string;
  options?: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }>;
  options_vi?: string[];
  explanation?: string;
  transcript?: string;
  transcript_vi?: string;
}

export interface ParseResult {
  detectedFormat: 'json' | 'csv' | 'txt';
  items: ParsedScriptItem[];
  counters: {
    totalItems: number;
    questionCount: number;
    groupCount: number;
    scriptEnCount: number;
    scriptViCount: number;
    errorsCount: number;
  };
  userFriendlyMessage?: string;
}

export const CANONICAL_PART3_RANGES = [
  '32-34', '35-37', '38-40', '41-43', '44-46', '47-49',
  '50-52', '53-55', '56-58', '59-61', '62-64', '65-67', '68-70'
];

export const CANONICAL_PART4_RANGES = [
  '71-73', '74-76', '77-79', '80-82', '83-85', '86-88',
  '89-91', '92-94', '95-97', '98-100'
];

export function isCanonicalGroupRange(rangeStr: string, part?: string): boolean {
  const norm = rangeStr.replace(/[\u2013\u2014–—~]/g, '-').trim();
  if (part === 'part3' || part === '3') return CANONICAL_PART3_RANGES.includes(norm);
  if (part === 'part4' || part === '4') return CANONICAL_PART4_RANGES.includes(norm);
  return CANONICAL_PART3_RANGES.includes(norm) || CANONICAL_PART4_RANGES.includes(norm);
}

export function parseHumanScriptText(text: string): ParsedScriptItem[] {
  const lines = text.split('\n');
  const items: ParsedScriptItem[] = [];

  let currentItem: ParsedScriptItem | null = null;
  let currentSection: 'en' | 'vi' | null = null;
  let rawEnLines: string[] = [];
  let rawViLines: string[] = [];

  const finalizeCurrentItem = () => {
    if (!currentItem) return;

    if (rawEnLines.length > 0) {
      if (currentItem.targetType === 'group') {
        currentItem.transcript = rawEnLines.join('\n').trim();
      } else {
        const optionLines: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }> = [];
        const nonOptionLines: string[] = [];

        rawEnLines.forEach(line => {
          const optMatch = line.match(/^\s*(?:[\(\[]?([A-D])[\)\]\.\:\s]+)(.*)$/i);
          if (optMatch) {
            const label = optMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
            const optText = optMatch[2].trim();
            optionLines.push({ label, text: optText });
          } else {
            nonOptionLines.push(line.trim());
          }
        });

        if (nonOptionLines.length > 0) {
          currentItem.question_text = nonOptionLines.join('\n').trim();
        }
        if (optionLines.length > 0) {
          currentItem.options = optionLines;
        }
      }
    }

    if (rawViLines.length > 0) {
      if (currentItem.targetType === 'group') {
        currentItem.transcript_vi = rawViLines.join('\n').trim();
      } else {
        const viOptions: Array<{ index: number; text: string }> = [];
        const nonOptionVi: string[] = [];

        rawViLines.forEach(line => {
          const optMatch = line.match(/^\s*(?:[\(\[]?([A-D])[\)\]\.\:\s]+)(.*)$/i);
          if (optMatch) {
            const label = optMatch[1].toUpperCase();
            const idx = label.charCodeAt(0) - 65;
            const optText = optMatch[2].trim();
            viOptions.push({ index: idx, text: optText });
          } else {
            nonOptionVi.push(line.trim());
          }
        });

        if (nonOptionVi.length > 0) {
          currentItem.translation_vi = nonOptionVi.join('\n').trim();
        }
        if (viOptions.length > 0) {
          const maxIdx = Math.max(...viOptions.map(v => v.index), 3);
          const optsViArr = new Array(maxIdx + 1).fill('');
          viOptions.forEach(v => {
            optsViArr[v.index] = v.text;
          });
          currentItem.options_vi = optsViArr;
        }
      }
    }

    items.push(currentItem);
    currentItem = null;
    currentSection = null;
    rawEnLines = [];
    rawViLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Ignore horizontal separators (e.g. ---, ***, ___)
    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      continue;
    }

    // Clean structural Markdown markers (#, ##, **, __) for header matching
    const cleanHeader = trimmed
      .replace(/^[#\s]+/, '')
      .replace(/^[\*\_\s]+/, '')
      .replace(/[\*\_\s]+$/, '')
      .trim();

    // Ignore section headers (e.g. # PART 3, PART 3, # PART 4, PART 4)
    if (/^(?:PART\s*[1-7]|PHẦN\s*[1-7])$/i.test(cleanHeader)) {
      continue;
    }

    // Check Question Range Header (e.g. ## CÂU 32–34, CÂU 32-34, Q32-34)
    // Replace Unicode dashes (en dash –, em dash —) with standard ASCII hyphen (-)
    const normalizedHeader = cleanHeader.replace(/[\u2013\u2014–—~]/g, '-');
    const rangeMatch = normalizedHeader.match(/^(?:CÂU|CAU|Q|QUESTION)\s*#?\s*(\d+)\s*-\s*(\d+)/i);
    if (rangeMatch) {
      finalizeCurrentItem();
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);

      let partName = 'part3';
      if (start >= 1 && end <= 6) partName = 'part1';
      else if (start >= 7 && end <= 31) partName = 'part2';
      else if (start >= 32 && end <= 70) partName = 'part3';
      else if (start >= 71 && end <= 100) partName = 'part4';
      else if (start >= 101 && end <= 130) partName = 'part5';
      else if (start >= 131 && end <= 146) partName = 'part6';
      else if (start >= 147 && end <= 200) partName = 'part7';

      currentItem = {
        targetType: 'group',
        startQuestion: start,
        endQuestion: end,
        range: `${start}-${end}`,
        part: partName,
      };
      continue;
    }

    // Check Single Question Header (e.g. CÂU 1, Q1, QUESTION 1)
    const qMatch = normalizedHeader.match(/^(?:CÂU|CAU|Q|QUESTION)\s*#?\s*(\d+)$/i);
    if (qMatch) {
      finalizeCurrentItem();
      const num = parseInt(qMatch[1], 10);
      let partName = 'part1';
      if (num >= 1 && num <= 6) partName = 'part1';
      else if (num >= 7 && num <= 31) partName = 'part2';
      else if (num >= 32 && num <= 70) partName = 'part3';
      else if (num >= 71 && num <= 100) partName = 'part4';
      else if (num >= 101 && num <= 130) partName = 'part5';
      else if (num >= 131 && num <= 146) partName = 'part6';
      else if (num >= 147 && num <= 200) partName = 'part7';

      currentItem = {
        targetType: 'question',
        number: num,
        part: partName,
      };
      continue;
    }

    // Check Section Headings (EN vs VI)
    const isEnHeading = /^(?:SCRIPT\s*TIẾNG\s*ANH|SCRIPT\s*EN|ENGLISH\s*SCRIPT|SCRIPT|TIẾNG\s*ANH|TIENG\s*ANH|CÂU\s*HỎI\s*TIẾNG\s*ANH|CAU\s*HOI\s*TIENG\s*ANH|CÂU\s*TRẢ\s*LỜI\s*TIẾNG\s*ANH|ENGLISH)$/i.test(cleanHeader);
    if (isEnHeading) {
      currentSection = 'en';
      continue;
    }

    const isViHeading = /^(?:BẢN\s*DỊCH\s*TIẾNG\s*VIỆT|BAN\s*DICH\s*TIENG\s*VIET|BẢN\s*DỊCH|BAN\s*DICH|DỊCH\s*TIẾNG\s*VIỆT|DICH\s*TIENG\s*VIET|TIẾNG\s*VIỆT|TIENG\s*VIET|VIETNAMESE|VI|BẢN\s*DỊCH\s*CÂU\s*HỎI)$/i.test(cleanHeader);
    if (isViHeading) {
      currentSection = 'vi';
      continue;
    }

    // Accumulate content lines into active section
    if (currentItem) {
      // Normalize Markdown bold speaker prefixes (e.g. **W:** -> W:, **M:** -> M:, **Nữ:** -> Nữ:, **Nam:** -> Nam:)
      let processedLine = trimmed;
      processedLine = processedLine.replace(/^\*\*([A-Za-z0-9\s\u00C0-\u1EF9]+:)\*\*\s*/gi, '$1 ');
      processedLine = processedLine.replace(/^__([A-Za-z0-9\s\u00C0-\u1EF9]+:)__\s*/gi, '$1 ');

      if (currentSection === 'vi') {
        rawViLines.push(processedLine.trim());
      } else {
        rawEnLines.push(processedLine.trim());
      }
    }
  }

  finalizeCurrentItem();
  return items;
}

/**
 * Main Auto-Detection Parser
 */
export function autoDetectAndParseScriptInput(
  input: string,
  preferredFormat: 'auto' | 'json' | 'csv' | 'txt' | 'pdf' = 'auto'
): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      detectedFormat: 'txt',
      items: [],
      counters: { totalItems: 0, questionCount: 0, groupCount: 0, scriptEnCount: 0, scriptViCount: 0, errorsCount: 0 },
      userFriendlyMessage: 'Vui lòng dán hoặc nhập nội dung.',
    };
  }

  // FORCE MODE OVERRIDES
  if (preferredFormat === 'json') {
    try {
      const obj = JSON.parse(trimmed);
      return parseJsonObject(obj);
    } catch (e: any) {
      return {
        detectedFormat: 'json',
        items: [],
        counters: { totalItems: 0, questionCount: 0, groupCount: 0, scriptEnCount: 0, scriptViCount: 0, errorsCount: 1 },
        userFriendlyMessage: 'JSON không hợp lệ.',
      };
    }
  }

  if (preferredFormat === 'txt') {
    const items = parseHumanScriptText(trimmed);
    return buildParseResult('txt', items, 'Đã nhận diện: Văn bản thường (TXT)');
  }

  // AUTO DETECTION LOGIC
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const obj = JSON.parse(trimmed);
      return parseJsonObject(obj);
    } catch (e) {
      // Not valid JSON, fallback to TXT
    }
  }

  // Fallback to Human Text / TXT Parser
  const items = parseHumanScriptText(trimmed);
  if (items.length > 0) {
    return buildParseResult('txt', items, 'Đã tự động nhận diện: Văn bản thường (TXT)');
  }

  return {
    detectedFormat: 'txt',
    items: [],
    counters: { totalItems: 0, questionCount: 0, groupCount: 0, scriptEnCount: 0, scriptViCount: 0, errorsCount: 1 },
    userFriendlyMessage: 'Chưa nhận diện được cấu trúc. Hãy dùng tiêu đề CÂU 1 / SCRIPT TIẾNG ANH / BẢN DỊCH TIẾNG VIỆT.',
  };
}

function parseJsonObject(obj: any): ParseResult {
  const items: ParsedScriptItem[] = [];

  const parseSection = (sectionObj: any, partName: string) => {
    if (!sectionObj || typeof sectionObj !== 'object') return;
    Object.entries(sectionObj).forEach(([key, val]: [string, any]) => {
      if (key.includes('-') || key.includes('–')) {
        const [startStr, endStr] = key.split(/[-–]/);
        items.push({
          targetType: 'group',
          startQuestion: parseInt(startStr, 10),
          endQuestion: parseInt(endStr, 10),
          range: `${startStr.trim()}-${endStr.trim()}`,
          part: partName,
          ...(val.transcript && { transcript: val.transcript }),
          ...(val.transcript_vi && { transcript_vi: val.transcript_vi }),
        });
      } else {
        const num = parseInt(key, 10);
        if (!isNaN(num)) {
          items.push({
            targetType: 'question',
            number: num,
            part: partName,
            ...(val.question_text && { question_text: val.question_text }),
            ...(val.translation_vi && { translation_vi: val.translation_vi }),
            ...(val.options && {
              options: Array.isArray(val.options)
                ? val.options.map((t: string, i: number) => ({ label: String.fromCharCode(65 + i) as any, text: t }))
                : val.options
            }),
            ...(val.options_vi && { options_vi: val.options_vi }),
            ...(val.explanation && { explanation: val.explanation }),
          });
        }
      }
    });
  };

  if (obj.part1) parseSection(obj.part1, 'part1');
  if (obj.part2) parseSection(obj.part2, 'part2');
  if (obj.part3) parseSection(obj.part3, 'part3');
  if (obj.part4) parseSection(obj.part4, 'part4');
  if (obj.part5) parseSection(obj.part5, 'part5');
  if (obj.part6) parseSection(obj.part6, 'part6');
  if (obj.part7) parseSection(obj.part7, 'part7');

  return buildParseResult('json', items, 'Đã tự động nhận diện: Cấu trúc JSON');
}

function buildParseResult(format: 'json' | 'csv' | 'txt', items: ParsedScriptItem[], message: string): ParseResult {
  let qCount = 0;
  let gCount = 0;
  let enCount = 0;
  let viCount = 0;

  items.forEach(item => {
    if (item.targetType === 'question') qCount++;
    if (item.targetType === 'group') gCount++;
    if (item.options?.some(o => o.text) || item.question_text || item.transcript) enCount++;
    if (item.options_vi?.some(v => v) || item.translation_vi || item.transcript_vi) viCount++;
  });

  return {
    detectedFormat: format,
    items,
    counters: {
      totalItems: items.length,
      questionCount: qCount,
      groupCount: gCount,
      scriptEnCount: enCount,
      scriptViCount: viCount,
      errorsCount: 0,
    },
    userFriendlyMessage: message,
  };
}
