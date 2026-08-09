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
        // Distribute lines for question
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

    // Check Question Range Header (e.g. CÂU 32-34, Q32-34)
    const rangeMatch = trimmed.match(/^(?:CÂU|CAU|Q|QUESTION)\s*#?\s*(\d+)\s*[-–~]\s*(\d+)/i);
    if (rangeMatch) {
      finalizeCurrentItem();
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      currentItem = {
        targetType: 'group',
        startQuestion: start,
        endQuestion: end,
        range: `${start}-${end}`,
      };
      continue;
    }

    // Check Single Question Header (e.g. CÂU 1, Q1, QUESTION 1)
    const qMatch = trimmed.match(/^(?:CÂU|CAU|Q|QUESTION)\s*#?\s*(\d+)/i);
    if (qMatch) {
      finalizeCurrentItem();
      const num = parseInt(qMatch[1], 10);
      currentItem = {
        targetType: 'question',
        number: num,
      };
      continue;
    }

    // Check Section Headings
    const isEnHeading = /^(?:SCRIPT\s*TIẾNG\s*ANH|SCRIPT\s*EN|ENGLISH\s*SCRIPT|SCRIPT|TIẾNG\s*ANH|TIENG\s*ANH|CÂU\s*HỎI\s*TIẾNG\s*ANH|CAU\s*HOI\s*TIENG\s*ANH|CÂU\s*TRẢ\s*LỜI\s*TIẾNG\s*ANH|ENGLISH)$/i.test(trimmed);
    if (isEnHeading) {
      currentSection = 'en';
      continue;
    }

    const isViHeading = /^(?:BẢN\s*DỊCH\s*TIẾNG\s*VIỆT|BAN\s*DICH\s*TIENG\s*VIET|BẢN\s*DỊCH|BAN\s*DICH|DỊCH\s*TIẾNG\s*VIỆT|DICH\s*TIENG\s*VIET|TIẾNG\s*VIỆT|TIENG\s*VIET|VIETNAMESE|VI|BẢN\s*DỊCH\s*CÂU\s*HỎI)$/i.test(trimmed);
    if (isViHeading) {
      currentSection = 'vi';
      continue;
    }

    // Accumulate lines into active section or default to EN
    if (currentItem) {
      if (currentSection === 'vi') {
        rawViLines.push(rawLine);
      } else {
        // Default section is English if not specified
        rawEnLines.push(rawLine);
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
