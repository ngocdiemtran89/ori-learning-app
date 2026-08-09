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

// 2. NATIVE FILENAME PARSER
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

// 3. SMART SUGGESTION DETECTOR
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

// 4. SEQUENTIAL MEDIA MAPPER
export function mapSequentialMediaFiles(
  rawFiles: RawMediaFile[],
  selectedMediaType: SequentialMediaType,
  questions: Array<{ id?: string; question_number: number; part: string; image_url?: string | null; audio_url?: string | null }>,
  groups: Array<{ id?: string; part: string; audio_url?: string | null }>,
  getGroupRange: (groupId: string) => { min: number; max: number },
  isPublished: boolean
): SequentialMappingResult {
  const filtered = rawFiles.filter(f => !isMacNoiseFile(f.name));
  const parsedFiles = filtered.map(f => ({
    ...f,
    parsed: parseNativeFilename(f.name),
  }));

  // Sort NUMERICALLY by sequence number
  parsedFiles.sort((a, b) => {
    const seqA = a.parsed.sequence ?? Number.MAX_SAFE_INTEGER;
    const seqB = b.parsed.sequence ?? Number.MAX_SAFE_INTEGER;
    if (seqA !== seqB) return seqA - seqB;
    return a.name.localeCompare(b.name);
  });

  const isImageMode = selectedMediaType === 'p1_image';
  const validExtensions = isImageMode ? ['jpg', 'jpeg', 'png', 'webp'] : ['mp3', 'wav', 'ogg', 'm4a'];

  // Allowed sequence ranges per type
  const allowedRanges: Record<SequentialMediaType, { min: number; max: number }> = {
    p1_image: { min: 1, max: 6 },
    p1_audio: { min: 1, max: 6 },
    p2_audio: { min: 1, max: 25 },
    p3_audio: { min: 1, max: 13 },
    p4_audio: { min: 1, max: 10 },
  };

  const range = allowedRanges[selectedMediaType];

  // Track sequence occurrences for duplicate check
  const seqCounts = new Map<number, number>();
  parsedFiles.forEach(f => {
    if (f.parsed.sequence !== null) {
      seqCounts.set(f.parsed.sequence, (seqCounts.get(f.parsed.sequence) || 0) + 1);
    }
  });

  // Track present valid sequences to detect missing numbers
  const presentSequences = new Set<number>();

  const mappedItems: SequentialMappedItem[] = [];

  parsedFiles.forEach(item => {
    const { rawName, extension, sequence } = item.parsed;

    // A. Extension check
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

    // B. Missing sequence check
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

    // C. Duplicate sequence check
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

    // D. Range check
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

    // E. Target Resolution
    let targetQNum: number | null = null;
    let startQ: number | null = null;
    let endQ: number | null = null;
    let isGroup = false;

    if (selectedMediaType === 'p1_image' || selectedMediaType === 'p1_audio') {
      targetQNum = sequence; // 1 -> Q1, 6 -> Q6
    } else if (selectedMediaType === 'p2_audio') {
      targetQNum = 6 + sequence; // 1 -> Q7, 25 -> Q31
    } else if (selectedMediaType === 'p3_audio') {
      isGroup = true;
      startQ = 32 + (sequence - 1) * 3;
      endQ = startQ + 2;
    } else if (selectedMediaType === 'p4_audio') {
      isGroup = true;
      startQ = 71 + (sequence - 1) * 3;
      endQ = startQ + 2;
    }

    if (!isGroup && targetQNum !== null) {
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
    } else if (isGroup && startQ !== null && endQ !== null) {
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
          targetLabel: `Q${startQ}–${endQ}`,
          currentExists: false,
          action: 'invalid',
          status: 'invalid',
          error: `Không tìm thấy nhóm câu hỏi Q${startQ}–${endQ}`,
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
          targetLabel: `Q${startQ}–${endQ}`,
          currentExists: false,
          action: 'invalid',
          status: 'invalid',
          error: `Tìm thấy nhiều hơn 1 nhóm khớp với dải câu Q${startQ}–${endQ}`,
        });
        return;
      }

      const g = matchingGroups[0];
      const currentExists = Boolean(g.audio_url);
      const action = isPublished && currentExists ? 'skip' : 'upload';

      mappedItems.push({
        name: rawName,
        file: item.file,
        sequence,
        type: 'audio',
        targetType: 'group',
        targetId: g.id,
        targetLabel: `Q${startQ}–${endQ} Group Audio`,
        currentExists,
        action,
        status: action === 'skip' ? 'skip' : 'ready',
      });
    }
  });

  // Calculate missing sequence numbers within expected 1..max Range
  const missingSequences: number[] = [];
  const maxSeqInPresent = presentSequences.size > 0 ? Math.max(...Array.from(presentSequences)) : range.max;
  const targetMax = Math.min(range.max, Math.max(maxSeqInPresent, range.min));

  for (let s = 1; s <= targetMax; s++) {
    if (!presentSequences.has(s)) {
      missingSequences.push(s);
    }
  }

  const suggestion = detectSequentialMediaSuggestion(rawFiles);

  return {
    items: mappedItems,
    counters: {
      totalFiles: filtered.length,
      matched: mappedItems.filter(i => i.status === 'ready' || i.status === 'skip').length,
      missingSequences,
      invalid: mappedItems.filter(i => i.status === 'invalid').length,
      conflict: mappedItems.filter(i => i.status === 'conflict').length,
      existingMedia: mappedItems.filter(i => i.status === 'skip').length,
      ready: mappedItems.filter(i => i.status === 'ready').length,
    },
    suggestion,
  };
}
