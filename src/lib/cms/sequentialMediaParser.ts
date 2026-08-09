// ============================================================
// Phase P3.5F: Sequential / Native Filename Media Parser & Mapper
// ============================================================

export type SequentialMediaType = 'p1_image' | 'p1_audio' | 'p2_audio' | 'p3_audio' | 'p4_audio';

export interface RawMediaFile {
  name: string;
  file?: File;
}

export interface ParsedNativeFilename {
  rawName: string;
  cleanBasename: string;
  extension: string; // lowercase without dot e.g. "mp3"
  isMacNoise: boolean;
  sequence: number | null;
}

export interface GroupAudioParseResult {
  rawName: string;
  cleanBasename: string;
  extension: string;
  isMacNoise: boolean;
  matchType: 'range' | 'sequential' | 'none';
  sequence: number | null;
  startQ: number | null;
  endQ: number | null;
  isValidRange: boolean;
  invalidReason?: string;
}

export interface SequentialMappedItem {
  name: string;
  file?: File;
  sequence: number | null;
  type: 'image' | 'audio';
  targetType: 'question' | 'group' | 'none';
  targetId?: string;
  targetLabel: string;
  currentExists: boolean;
  action: 'upload' | 'skip' | 'invalid' | 'conflict';
  status: 'pending' | 'ready' | 'skip' | 'invalid' | 'conflict' | 'uploading' | 'success' | 'failed';
  error?: string;
}

export interface SequentialMappingResult {
  items: SequentialMappedItem[];
  counters: {
    totalFiles: number;
    matched: number;
    missingSequences: number[];
    missingGroupLabels: string[];
    invalid: number;
    conflict: number;
    existingMedia: number;
    ready: number;
  };
  suggestion: {
    mediaType: SequentialMediaType | null;
    message: string | null;
  };
}

// 1. MACOS NOISE FILTER
export function isMacNoiseFile(filename: string): boolean {
  const name = filename.trim();
  const basename = name.split('/').pop() || name;
  return (
    name.includes('__MACOSX') ||
    basename === '.DS_Store' ||
    basename.startsWith('._')
  );
}

// 2. NATIVE FILENAME PARSER (Single Question / Default)
export function parseNativeFilename(filename: string): ParsedNativeFilename {
  const isNoise = isMacNoiseFile(filename);
  const rawName = filename;
  const basename = (filename.split('/').pop() || filename).trim();
  
  const extMatch = basename.match(/\.([a-zA-Z0-9]+)$/);
  const extension = extMatch ? extMatch[1].toLowerCase() : '';
  const nameWithoutExt = extMatch ? basename.substring(0, extMatch.index) : basename;

  if (isNoise || !nameWithoutExt) {
    return {
      rawName,
      cleanBasename: basename,
      extension,
      isMacNoise: isNoise,
      sequence: null,
    };
  }

  // Extract integer tokens separated by non-digit characters
  const tokens = nameWithoutExt
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(t => parseInt(t, 10));

  const sequence = tokens.length > 0 ? tokens[tokens.length - 1] : null;

  return {
    rawName,
    cleanBasename: basename,
    extension,
    isMacNoise: false,
    sequence,
  };
}

// 3. GROUP AUDIO VALID DISCRETE RANGES
export const PART3_VALID_RANGES: Array<[number, number]> = [
  [32, 34], [35, 37], [38, 40], [41, 43], [44, 46],
  [47, 49], [50, 52], [53, 55], [56, 58], [59, 61],
  [62, 64], [65, 67], [68, 70]
];

export const PART4_VALID_RANGES: Array<[number, number]> = [
  [71, 73], [74, 76], [77, 79], [80, 82], [83, 85],
  [86, 88], [89, 91], [92, 94], [95, 97], [98, 100]
];

// 4. ADVANCED GROUP AUDIO PARSER (Question Range + Sequential Precedence)
export function parseGroupAudioFilename(filename: string, mediaType: 'p3_audio' | 'p4_audio'): GroupAudioParseResult {
  const isNoise = isMacNoiseFile(filename);
  const rawName = filename;
  const basename = (filename.split('/').pop() || filename).trim();
  
  const extMatch = basename.match(/\.([a-zA-Z0-9]+)$/);
  const extension = extMatch ? extMatch[1].toLowerCase() : '';
  const nameWithoutExt = extMatch ? basename.substring(0, extMatch.index) : basename;

  if (isNoise || !nameWithoutExt) {
    return {
      rawName,
      cleanBasename: basename,
      extension,
      isMacNoise: isNoise,
      matchType: 'none',
      sequence: null,
      startQ: null,
      endQ: null,
      isValidRange: false,
      invalidReason: 'File rác hệ thống hoặc tên rỗng',
    };
  }

  const tokens = nameWithoutExt
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(t => parseInt(t, 10));

  const validRanges = mediaType === 'p3_audio' ? PART3_VALID_RANGES : PART4_VALID_RANGES;
  const baseStart = mediaType === 'p3_audio' ? 32 : 71;

  // Precedence 1: Trailing Question Range
  if (tokens.length >= 2) {
    const candStart = tokens[tokens.length - 2];
    const candEnd = tokens[tokens.length - 1];

    const rangeIndex = validRanges.findIndex(([s, e]) => s === candStart && e === candEnd);
    if (rangeIndex !== -1) {
      const sequence = rangeIndex + 1; // 1-indexed sequence (1..13 or 1..10)
      return {
        rawName,
        cleanBasename: basename,
        extension,
        isMacNoise: false,
        matchType: 'range',
        sequence,
        startQ: candStart,
        endQ: candEnd,
        isValidRange: true,
      };
    }

    const isP3Candidate = mediaType === 'p3_audio' && candStart >= 32 && candEnd <= 70 && (candEnd - candStart === 2);
    const isP4Candidate = mediaType === 'p4_audio' && candStart >= 71 && candEnd <= 100 && (candEnd - candStart === 2);

    if (isP3Candidate || isP4Candidate) {
      return {
        rawName,
        cleanBasename: basename,
        extension,
        isMacNoise: false,
        matchType: 'range',
        sequence: null,
        startQ: candStart,
        endQ: candEnd,
        isValidRange: false,
        invalidReason: `Dải câu Q${candStart}–${candEnd} không thuộc các nhóm câu chuẩn của ${mediaType === 'p3_audio' ? 'Part 3' : 'Part 4'}`,
      };
    }
  }

  // Precedence 2: Sequential Fallback
  if (tokens.length > 0) {
    const seq = tokens[tokens.length - 1];
    const maxSeq = mediaType === 'p3_audio' ? 13 : 10;
    if (seq >= 1 && seq <= maxSeq) {
      const startQ = baseStart + (seq - 1) * 3;
      const endQ = startQ + 2;
      return {
        rawName,
        cleanBasename: basename,
        extension,
        isMacNoise: false,
        matchType: 'sequential',
        sequence: seq,
        startQ,
        endQ,
        isValidRange: true,
      };
    }
  }

  return {
    rawName,
    cleanBasename: basename,
    extension,
    isMacNoise: false,
    matchType: 'none',
    sequence: null,
    startQ: null,
    endQ: null,
    isValidRange: false,
    invalidReason: `Số thứ tự không hợp lệ hoặc nằm ngoài phạm vi cho ${mediaType === 'p3_audio' ? 'Part 3 (1–13)' : 'Part 4 (1–10)'}`,
  };
}

// 5. SMART SUGGESTION DETECTOR
export function detectSequentialMediaSuggestion(files: RawMediaFile[]): {
  mediaType: SequentialMediaType | null;
  message: string | null;
} {
  const validFiles = files
    .filter(f => !isMacNoiseFile(f.name))
    .map(f => parseNativeFilename(f.name));

  const audioCount = validFiles.filter(f => ['mp3', 'wav', 'ogg', 'm4a'].includes(f.extension)).length;
  const imageCount = validFiles.filter(f => ['jpg', 'jpeg', 'png', 'webp'].includes(f.extension)).length;

  if (audioCount === 13) {
    return {
      mediaType: 'p3_audio',
      message: 'Phát hiện 13 file audio — có thể đây là Part 3 (13 nhóm hội thoại).',
    };
  }
  if (audioCount === 10) {
    return {
      mediaType: 'p4_audio',
      message: 'Phát hiện 10 file audio — có thể đây là Part 4 (10 nhóm bài nói).',
    };
  }
  if (audioCount === 25) {
    return {
      mediaType: 'p2_audio',
      message: 'Phát hiện 25 file audio — có thể đây là Part 2 (câu 7–31).',
    };
  }
  if (imageCount === 6) {
    return {
      mediaType: 'p1_image',
      message: 'Phát hiện 6 file hình ảnh — có thể đây là Part 1 (hình ảnh câu 1–6).',
    };
  }
  if (audioCount === 6) {
    return {
      mediaType: 'p1_audio',
      message: 'Phát hiện 6 file audio — có thể đây là Part 1 (audio câu 1–6).',
    };
  }

  return { mediaType: null, message: null };
}

// 6. SEQUENTIAL / RANGE MEDIA MAPPER
export function mapSequentialMediaFiles(
  rawFiles: RawMediaFile[],
  selectedMediaType: SequentialMediaType,
  questions: Array<{ id?: string; question_number: number; part: string; image_url?: string | null; audio_url?: string | null }>,
  groups: Array<{ id?: string; part: string; audio_url?: string | null }>,
  getGroupRange: (groupId: string) => { min: number; max: number },
  isPublished: boolean
): SequentialMappingResult {
  const filtered = rawFiles.filter(f => !isMacNoiseFile(f.name));
  const isGroupAudio = selectedMediaType === 'p3_audio' || selectedMediaType === 'p4_audio';

  const isImageMode = selectedMediaType === 'p1_image';
  const validExtensions = isImageMode ? ['jpg', 'jpeg', 'png', 'webp'] : ['mp3', 'wav', 'ogg', 'm4a'];

  const allowedRanges: Record<SequentialMediaType, { min: number; max: number }> = {
    p1_image: { min: 1, max: 6 },
    p1_audio: { min: 1, max: 6 },
    p2_audio: { min: 1, max: 25 },
    p3_audio: { min: 1, max: 13 },
    p4_audio: { min: 1, max: 10 },
  };
  const range = allowedRanges[selectedMediaType];

  // For group audio, parse using parseGroupAudioFilename
  if (isGroupAudio) {
    const groupParsed = filtered.map(f => ({
      ...f,
      parsedGroup: parseGroupAudioFilename(f.name, selectedMediaType as 'p3_audio' | 'p4_audio'),
    }));

    // Sort by sequence or startQ
    groupParsed.sort((a, b) => {
      const seqA = a.parsedGroup.sequence ?? Number.MAX_SAFE_INTEGER;
      const seqB = b.parsedGroup.sequence ?? Number.MAX_SAFE_INTEGER;
      if (seqA !== seqB) return seqA - seqB;
      return a.name.localeCompare(b.name);
    });

    // Check duplicate target ranges (e.g. Q32–34 mapped twice)
    const targetGroupCounts = new Map<string, number>();
    groupParsed.forEach(item => {
      if (item.parsedGroup.isValidRange && item.parsedGroup.startQ !== null && item.parsedGroup.endQ !== null) {
        const key = `Q${item.parsedGroup.startQ}–${item.parsedGroup.endQ}`;
        targetGroupCounts.set(key, (targetGroupCounts.get(key) || 0) + 1);
      }
    });

    const presentGroupKeys = new Set<string>();
    const presentSequences = new Set<number>();
    const mappedItems: SequentialMappedItem[] = [];

    groupParsed.forEach(item => {
      const { rawName, extension, sequence, startQ, endQ, isValidRange, invalidReason } = item.parsedGroup;

      if (!validExtensions.includes(extension)) {
        mappedItems.push({
          name: rawName,
          file: item.file,
          sequence,
          type: 'audio',
          targetType: 'none',
          targetLabel: 'Không khớp loại media',
          currentExists: false,
          action: 'invalid',
          status: 'invalid',
          error: 'File không phải là audio (mp3, wav...)',
        });
        return;
      }

      if (!isValidRange || startQ === null || endQ === null) {
        mappedItems.push({
          name: rawName,
          file: item.file,
          sequence: null,
          type: 'audio',
          targetType: 'none',
          targetLabel: startQ && endQ ? `Q${startQ}–${endQ} (Không hợp lệ)` : 'Không khớp nhóm',
          currentExists: false,
          action: 'invalid',
          status: 'invalid',
          error: invalidReason || 'Không xác định được nhóm câu hỏi hợp lệ',
        });
        return;
      }

      const targetGroupKey = `Q${startQ}–${endQ}`;

      // Duplicate Check across TARGET GROUPS
      if ((targetGroupCounts.get(targetGroupKey) || 0) > 1) {
        mappedItems.push({
          name: rawName,
          file: item.file,
          sequence,
          type: 'audio',
          targetType: 'none',
          targetLabel: `Trùng nhóm ${targetGroupKey}`,
          currentExists: false,
          action: 'conflict',
          status: 'conflict',
          error: `Phát hiện nhiều file cùng gán vào nhóm câu ${targetGroupKey}`,
        });
        return;
      }

      // Group DB lookup
      const matchingGroups = groups.filter(g => {
        if (!g.id) return false;
        const r = getGroupRange(g.id);
        return r.min === startQ && r.max === endQ;
      });

      if (matchingGroups.length === 0) {
        mappedItems.push({
          name: rawName,
          file: item.file,
          sequence,
          type: 'audio',
          targetType: 'group',
          targetLabel: targetGroupKey,
          currentExists: false,
          action: 'invalid',
          status: 'invalid',
          error: `Không tìm thấy nhóm câu hỏi ${targetGroupKey} trong đề thi`,
        });
        return;
      }

      if (matchingGroups.length > 1) {
        mappedItems.push({
          name: rawName,
          file: item.file,
          sequence,
          type: 'audio',
          targetType: 'group',
          targetLabel: targetGroupKey,
          currentExists: false,
          action: 'invalid',
          status: 'invalid',
          error: `Tìm thấy nhiều hơn 1 nhóm trùng khớp với ${targetGroupKey}`,
        });
        return;
      }

      const g = matchingGroups[0];
      const currentExists = Boolean(g.audio_url);
      const action = isPublished && currentExists ? 'skip' : 'upload';

      presentGroupKeys.add(targetGroupKey);
      if (sequence !== null) presentSequences.add(sequence);

      mappedItems.push({
        name: rawName,
        file: item.file,
        sequence,
        type: 'audio',
        targetType: 'group',
        targetId: g.id,
        targetLabel: `${targetGroupKey} Group Audio`,
        currentExists,
        action,
        status: action === 'skip' ? 'skip' : 'ready',
      });
    });

    const expectedRanges = selectedMediaType === 'p3_audio' ? PART3_VALID_RANGES : PART4_VALID_RANGES;
    const missingGroupLabels: string[] = [];
    const missingSequences: number[] = [];

    expectedRanges.forEach(([s, e], idx) => {
      const label = `Q${s}–${e}`;
      if (!presentGroupKeys.has(label)) {
        missingGroupLabels.push(label);
        missingSequences.push(idx + 1);
      }
    });

    const ready = mappedItems.filter(i => i.status === 'ready').length;
    const existingMedia = mappedItems.filter(i => i.status === 'skip').length;
    const invalid = mappedItems.filter(i => i.status === 'invalid').length;
    const conflict = mappedItems.filter(i => i.status === 'conflict').length;

    return {
      items: mappedItems,
      counters: {
        totalFiles: filtered.length,
        matched: ready + existingMedia,
        missingSequences,
        missingGroupLabels,
        invalid,
        conflict,
        existingMedia,
        ready,
      },
      suggestion: detectSequentialMediaSuggestion(rawFiles),
    };
  }

  // Single Question mapping (Part 1 Image, Part 1 Audio, Part 2 Audio)
  const parsedFiles = filtered.map(f => ({
    ...f,
    parsed: parseNativeFilename(f.name),
  }));

  parsedFiles.sort((a, b) => {
    const seqA = a.parsed.sequence ?? Number.MAX_SAFE_INTEGER;
    const seqB = b.parsed.sequence ?? Number.MAX_SAFE_INTEGER;
    if (seqA !== seqB) return seqA - seqB;
    return a.name.localeCompare(b.name);
  });

  const seqCounts = new Map<number, number>();
  parsedFiles.forEach(f => {
    if (f.parsed.sequence !== null) {
      seqCounts.set(f.parsed.sequence, (seqCounts.get(f.parsed.sequence) || 0) + 1);
    }
  });

  const presentSequences = new Set<number>();
  const mappedItems: SequentialMappedItem[] = [];

  parsedFiles.forEach(item => {
    const { rawName, extension, sequence } = item.parsed;

    if (!validExtensions.includes(extension)) {
      mappedItems.push({
        name: rawName,
        file: item.file,
        sequence,
        type: isImageMode ? 'image' : 'audio',
        targetType: 'none',
        targetLabel: 'Không khớp loại media',
        currentExists: false,
        action: 'invalid',
        status: 'invalid',
        error: isImageMode ? 'File không phải là hình ảnh (jpg, png...)' : 'File không phải là audio (mp3, wav...)',
      });
      return;
    }

    if (sequence === null) {
      mappedItems.push({
        name: rawName,
        file: item.file,
        sequence: null,
        type: isImageMode ? 'image' : 'audio',
        targetType: 'none',
        targetLabel: 'Thiếu số thứ tự',
        currentExists: false,
        action: 'invalid',
        status: 'invalid',
        error: 'Tên file không chứa số thứ tự hợp lệ',
      });
      return;
    }

    if ((seqCounts.get(sequence) || 0) > 1) {
      mappedItems.push({
        name: rawName,
        file: item.file,
        sequence,
        type: isImageMode ? 'image' : 'audio',
        targetType: 'none',
        targetLabel: `Trùng số thứ tự #${sequence}`,
        currentExists: false,
        action: 'conflict',
        status: 'conflict',
        error: `Phát hiện nhiều file cùng chứa số thứ tự #${sequence}`,
      });
      return;
    }

    if (sequence < range.min || sequence > range.max) {
      mappedItems.push({
        name: rawName,
        file: item.file,
        sequence,
        type: isImageMode ? 'image' : 'audio',
        targetType: 'none',
        targetLabel: `Ngoài phạm vi (#${sequence})`,
        currentExists: false,
        action: 'invalid',
        status: 'invalid',
        error: `Số thứ tự #${sequence} nằm ngoài phạm vi ${range.min}–${range.max} cho phần này`,
      });
      return;
    }

    presentSequences.add(sequence);

    let targetQNum: number | null = null;
    if (selectedMediaType === 'p1_image' || selectedMediaType === 'p1_audio') {
      targetQNum = sequence;
    } else if (selectedMediaType === 'p2_audio') {
      targetQNum = 6 + sequence;
    }

    if (targetQNum !== null) {
      const q = questions.find(item => item.question_number === targetQNum);
      if (!q || !q.id) {
        mappedItems.push({
          name: rawName,
          file: item.file,
          sequence,
          type: isImageMode ? 'image' : 'audio',
          targetType: 'question',
          targetLabel: `Q${targetQNum}`,
          currentExists: false,
          action: 'invalid',
          status: 'invalid',
          error: `Không tìm thấy câu hỏi Q${targetQNum} trong đề thi`,
        });
        return;
      }

      const currentExists = isImageMode ? Boolean(q.image_url) : Boolean(q.audio_url);
      const action = isPublished && currentExists ? 'skip' : 'upload';

      mappedItems.push({
        name: rawName,
        file: item.file,
        sequence,
        type: isImageMode ? 'image' : 'audio',
        targetType: 'question',
        targetId: q.id,
        targetLabel: `Q${targetQNum} (${isImageMode ? 'Hình ảnh' : 'Audio'})`,
        currentExists,
        action,
        status: action === 'skip' ? 'skip' : 'ready',
      });
    }
  });

  const missingSequences: number[] = [];
  for (let s = range.min; s <= range.max; s++) {
    if (!presentSequences.has(s)) {
      missingSequences.push(s);
    }
  }

  const ready = mappedItems.filter(i => i.status === 'ready').length;
  const existingMedia = mappedItems.filter(i => i.status === 'skip').length;
  const invalid = mappedItems.filter(i => i.status === 'invalid').length;
  const conflict = mappedItems.filter(i => i.status === 'conflict').length;

  return {
    items: mappedItems,
    counters: {
      totalFiles: filtered.length,
      matched: ready + existingMedia,
      missingSequences,
      missingGroupLabels: missingSequences.map(seq => `Q${seq}`),
      invalid,
      conflict,
      existingMedia,
      ready,
    },
    suggestion: detectSequentialMediaSuggestion(rawFiles),
  };
}
