// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Media Matcher
// ============================================================

import { OriPackageMediaEntry, RawPackageSources, PackageMediaConventions, P2NumberingConvention, P3NumberingConvention, P4NumberingConvention } from './types';
import { isMacNoiseFile, parseGroupAudioFilename } from '../cms/sequentialMediaParser';

export interface OriPackageMediaList extends Array<OriPackageMediaEntry> {
  conventions?: PackageMediaConventions;
}

// Helper to extract last numeric token from file basename
export const getLastNumericToken = (file: File): number | null => {
  const basename = (file.name.split('/').pop() || file.name).toLowerCase();
  const nameWithoutExt = basename.substring(0, basename.lastIndexOf('.'));
  const tokens = nameWithoutExt.split(/[^0-9]+/).filter(Boolean).map(t => parseInt(t, 10));
  return tokens.length > 0 ? tokens[tokens.length - 1] : null;
};

// --- A. PURE BATCH DETECTOR FOR PART 2 ---
export function detectP2NumberingConvention(p2Files: File[]): P2NumberingConvention {
  if (!p2Files || p2Files.length === 0) return 'P2_NONE';

  const suffixes = p2Files
    .map(getLastNumericToken)
    .filter((s): s is number => s !== null);

  const sortedUnique = Array.from(new Set(suffixes)).sort((a, b) => a - b);

  // Exact 25 unique suffixes matching 1..25 => P2_LOCAL_INDEX
  const isExactLocal25 =
    sortedUnique.length === 25 &&
    sortedUnique.every((val, idx) => val === idx + 1);

  if (isExactLocal25) {
    return 'P2_LOCAL_INDEX';
  }

  // Exact 25 unique suffixes matching 7..31 => P2_GLOBAL_QNUM
  const isExactGlobal25 =
    sortedUnique.length === 25 &&
    sortedUnique.every((val, idx) => val === idx + 7);

  if (isExactGlobal25) {
    return 'P2_GLOBAL_QNUM';
  }

  // Canonical ORI format q007.mp3..q031.mp3
  const isCanonicalOriP2 =
    p2Files.length === 25 &&
    p2Files.every(f => /^q0*([7-9]|[12][0-9]|3[01])\.(mp3|wav|ogg|m4a)$/i.test((f.name.split('/').pop() || f.name).toLowerCase()));

  if (isCanonicalOriP2) {
    return 'P2_GLOBAL_QNUM';
  }

  // Fallback for 25 files in 7..31 without duplicates
  if (
    p2Files.length === 25 &&
    sortedUnique.length === 25 &&
    sortedUnique[0] === 7 &&
    sortedUnique[24] === 31
  ) {
    return 'P2_GLOBAL_QNUM';
  }

  // Fallback for 25 files in 1..25 without duplicates
  if (
    p2Files.length === 25 &&
    sortedUnique.length === 25 &&
    sortedUnique[0] === 1 &&
    sortedUnique[24] === 25
  ) {
    return 'P2_LOCAL_INDEX';
  }

  // Subsets where all suffixes are strictly within 7..31
  if (sortedUnique.length > 0 && sortedUnique.every(s => s >= 7 && s <= 31)) {
    return 'P2_GLOBAL_QNUM';
  }

  // Subsets where all suffixes are strictly within 1..25
  if (sortedUnique.length > 0 && sortedUnique.every(s => s >= 1 && s <= 25) && !sortedUnique.some(s => s >= 26)) {
    return 'P2_LOCAL_INDEX';
  }

  return 'P2_NUMBERING_AMBIGUOUS';
}

// --- B. PURE BATCH DETECTOR FOR PART 3 ---
export function detectP3NumberingConvention(p3Files: File[]): P3NumberingConvention {
  if (!p3Files || p3Files.length === 0) return 'P3_NONE';

  const allRanges = p3Files.map(f => parseGroupAudioFilename(f.name, 'p3_audio'));
  const areAllRanges = allRanges.every(r => r.matchType === 'range' && r.isValidRange);

  if (areAllRanges) {
    return 'P3_RANGE';
  }

  const suffixes = p3Files
    .map(getLastNumericToken)
    .filter((s): s is number => s !== null);

  const sortedUnique = Array.from(new Set(suffixes)).sort((a, b) => a - b);

  if (sortedUnique.length === 13 && sortedUnique.every((val, idx) => val === idx + 1)) {
    return 'P3_LOCAL_INDEX';
  }

  if (sortedUnique.length === 13 && sortedUnique.every((val, idx) => val === 32 + idx * 3)) {
    return 'P3_GLOBAL_STARTQ';
  }

  if (sortedUnique.length > 0 && sortedUnique.every(s => s >= 1 && s <= 13)) {
    return 'P3_LOCAL_INDEX';
  }

  if (sortedUnique.length > 0 && sortedUnique.every(s => s >= 32 && s <= 68 && (s - 32) % 3 === 0)) {
    return 'P3_GLOBAL_STARTQ';
  }

  return 'P3_NUMBERING_AMBIGUOUS';
}

// --- C. PURE BATCH DETECTOR FOR PART 4 ---
export function detectP4NumberingConvention(p4Files: File[]): P4NumberingConvention {
  if (!p4Files || p4Files.length === 0) return 'P4_NONE';

  const allRanges = p4Files.map(f => parseGroupAudioFilename(f.name, 'p4_audio'));
  const areAllRanges = allRanges.every(r => r.matchType === 'range' && r.isValidRange);

  if (areAllRanges) {
    return 'P4_RANGE';
  }

  const suffixes = p4Files
    .map(getLastNumericToken)
    .filter((s): s is number => s !== null);

  const sortedUnique = Array.from(new Set(suffixes)).sort((a, b) => a - b);

  if (sortedUnique.length === 10 && sortedUnique.every((val, idx) => val === idx + 1)) {
    return 'P4_LOCAL_INDEX';
  }

  if (sortedUnique.length === 10 && sortedUnique.every((val, idx) => val === 71 + idx * 3)) {
    return 'P4_GLOBAL_STARTQ';
  }

  if (sortedUnique.length > 0 && sortedUnique.every(s => s >= 1 && s <= 10)) {
    return 'P4_LOCAL_INDEX';
  }

  if (sortedUnique.length > 0 && sortedUnique.every(s => s >= 71 && s <= 98 && (s - 71) % 3 === 0)) {
    return 'P4_GLOBAL_STARTQ';
  }

  return 'P4_NUMBERING_AMBIGUOUS';
}

// --- AUTHORITATIVE MEDIA MATCHING FUNCTION ---
export function matchPackageMedia(sources: RawPackageSources): OriPackageMediaList {
  const mediaEntries: OriPackageMediaEntry[] = [];
  
  // Deduplicate input audio files by filename/size to prevent duplicate references
  const rawAudioFiles = sources.audioFiles || [];
  const seenFileKeys = new Set<string>();
  const audioFiles: File[] = [];

  for (const f of rawAudioFiles) {
    if (isMacNoiseFile(f.name)) continue;
    const key = `${f.name}_${f.size}`;
    if (!seenFileKeys.has(key)) {
      seenFileKeys.add(key);
      audioFiles.push(f);
    }
  }

  // 1. PART 1 IMAGES
  const p1CroppedMap = sources.part1PdfCroppedImages || {};
  const p1ImgTargetMap = new Map<number, File | Blob>();
  const p1ImgFilenameMap = new Map<number, string>();

  // Check cropped map first
  for (let qNum = 1; qNum <= 6; qNum++) {
    if (p1CroppedMap[qNum]) {
      p1ImgTargetMap.set(qNum, p1CroppedMap[qNum]);
      p1ImgFilenameMap.set(qNum, `p1_q${qNum}_cropped.png`);
    }
  }

  // Check standalone image files uploaded in audioFiles
  const imageFiles = audioFiles.filter(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
  });

  imageFiles.forEach(f => {
    const basename = (f.name.split('/').pop() || f.name).toLowerCase();
    const match = basename.match(/(?:q|p1_)?0*([1-6])\.(jpg|jpeg|png|webp)$/i);
    if (match) {
      const qNum = parseInt(match[1], 10);
      if (!p1ImgTargetMap.has(qNum)) {
        p1ImgTargetMap.set(qNum, f);
        p1ImgFilenameMap.set(qNum, f.name);
      }
    }
  });

  for (let qNum = 1; qNum <= 6; qNum++) {
    const imgFile = p1ImgTargetMap.get(qNum);
    if (imgFile) {
      const canonicalTarget = `P1-IMG-Q00${qNum}`;
      mediaEntries.push({
        id: `p1-img-q${qNum}`,
        targetType: 'question',
        targetNumberOrRange: `Q${qNum}`,
        canonicalTarget,
        part: 1,
        localIndex: qNum,
        mediaType: 'image',
        file: imgFile,
        filename: p1ImgFilenameMap.get(qNum) || `p1_q${qNum}.png`,
        status: 'ready',
      });
    }
  }

  // 2. AUDIO FILES MATCHING & BATCH CONVENTION DETECTION
  const realAudioFiles = audioFiles.filter(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg') || name.endsWith('.m4a');
  });

  // Categorize files by Part
  const p1Files: File[] = [];
  const p2Files: File[] = [];
  const p3Files: File[] = [];
  const p4Files: File[] = [];

  realAudioFiles.forEach(f => {
    const path = f.name.toLowerCase();
    const pathWithoutExt = path.substring(0, path.lastIndexOf('.'));
    const basename = (f.name.split('/').pop() || f.name).toLowerCase();

    // Canonical ORI filenames (q001.mp3, q032-034.mp3)
    if (/^q0*([1-6])\.(mp3|wav|ogg|m4a)$/.test(basename)) {
      p1Files.push(f);
      return;
    }
    if (/^q0*([7-9]|[12][0-9]|3[01])\.(mp3|wav|ogg|m4a)$/.test(basename)) {
      p2Files.push(f);
      return;
    }
    if (/^q0*([3-6][0-9]|70)[–\-]+0*([3-6][0-9]|70)\.(mp3|wav|ogg|m4a)$/.test(basename)) {
      p3Files.push(f);
      return;
    }
    if (/^q0*(7[1-9]|[89][0-9]|100)[–\-]+0*(7[1-9]|[89][0-9]|100)\.(mp3|wav|ogg|m4a)$/.test(basename)) {
      p4Files.push(f);
      return;
    }

    const isP1 = /part[\s_\-]*1|p1/i.test(pathWithoutExt);
    const isP2 = /part[\s_\-]*2|p2/i.test(pathWithoutExt);
    const isP3 = /part[\s_\-]*3|p3/i.test(pathWithoutExt);
    const isP4 = /part[\s_\-]*4|p4/i.test(pathWithoutExt);

    if (isP1) p1Files.push(f);
    else if (isP2) p2Files.push(f);
    else if (isP3) p3Files.push(f);
    else if (isP4) p4Files.push(f);
    else {
      // Check group range first (e.g. 32-34, 71-73)
      const p3Range = parseGroupAudioFilename(f.name, 'p3_audio');
      if (p3Range.matchType === 'range' && p3Range.isValidRange) {
        p3Files.push(f);
        return;
      }
      const p4Range = parseGroupAudioFilename(f.name, 'p4_audio');
      if (p4Range.matchType === 'range' && p4Range.isValidRange) {
        p4Files.push(f);
        return;
      }

      // Fallback part resolution by numeric tokens
      const nameWithoutExt = basename.substring(0, basename.lastIndexOf('.'));
      const tokens = nameWithoutExt.split(/[^0-9]+/).filter(Boolean).map(t => parseInt(t, 10));
      if (tokens.length > 0) {
        const last = tokens[tokens.length - 1];
        if (last >= 7 && last <= 31) p2Files.push(f);
        else if (last >= 1 && last <= 6) p1Files.push(f);
        else if (last >= 32 && last <= 70) p3Files.push(f);
        else if (last >= 71 && last <= 100) p4Files.push(f);
      }
    }
  });

  // Detect Batch Conventions
  const p2Convention = detectP2NumberingConvention(p2Files);
  const p3Convention = detectP3NumberingConvention(p3Files);
  const p4Convention = detectP4NumberingConvention(p4Files);

  const candidateList: Array<{
    file: File;
    targetType: 'question' | 'group';
    targetKey: string;
    canonicalTarget: string;
    part: number;
    localIndex: number;
    mediaType: 'audio';
    isAmbiguous?: boolean;
  }> = [];

  // MAPPING EXECUTION — PART 1 AUDIO
  p1Files.forEach(f => {
    const token = getLastNumericToken(f);
    if (token !== null && token >= 1 && token <= 6) {
      candidateList.push({
        file: f,
        targetType: 'question',
        targetKey: `Q${token}`,
        canonicalTarget: `P1-Q00${token}`,
        part: 1,
        localIndex: token,
        mediaType: 'audio',
      });
    }
  });

  // MAPPING EXECUTION — PART 2 AUDIO
  p2Files.forEach(f => {
    const token = getLastNumericToken(f);
    if (p2Convention === 'P2_GLOBAL_QNUM') {
      if (token !== null && token >= 7 && token <= 31) {
        const qNum = token;
        const localIdx = token - 6;
        const canonicalTarget = `P2-Q${qNum < 10 ? '00' : '0'}${qNum}`;
        candidateList.push({
          file: f,
          targetType: 'question',
          targetKey: `Q${qNum}`,
          canonicalTarget,
          part: 2,
          localIndex: localIdx,
          mediaType: 'audio',
        });
      }
    } else if (p2Convention === 'P2_LOCAL_INDEX') {
      if (token !== null && token >= 1 && token <= 25) {
        const localIdx = token;
        const qNum = 6 + token;
        const canonicalTarget = `P2-Q${qNum < 10 ? '00' : '0'}${qNum}`;
        candidateList.push({
          file: f,
          targetType: 'question',
          targetKey: `Q${qNum}`,
          canonicalTarget,
          part: 2,
          localIndex: localIdx,
          mediaType: 'audio',
        });
      }
    } else {
      // P2_NUMBERING_AMBIGUOUS
      const qNum = token || 7;
      candidateList.push({
        file: f,
        targetType: 'question',
        targetKey: token ? `Q${token}` : 'Q7',
        canonicalTarget: `P2-Q${qNum < 10 ? '00' : '0'}${qNum}`,
        part: 2,
        localIndex: token ? Math.max(1, token - 6) : 1,
        mediaType: 'audio',
        isAmbiguous: true,
      });
    }
  });

  // MAPPING EXECUTION — PART 3 AUDIO
  p3Files.forEach(f => {
    if (p3Convention === 'P3_RANGE') {
      const parsed = parseGroupAudioFilename(f.name, 'p3_audio');
      if (parsed.matchType === 'range' && parsed.isValidRange && parsed.startQ !== null && parsed.endQ !== null) {
        const startQ = parsed.startQ;
        const endQ = parsed.endQ;
        const localIdx = Math.floor((startQ - 32) / 3) + 1;
        candidateList.push({
          file: f,
          targetType: 'group',
          targetKey: `Q${startQ}–${endQ}`,
          canonicalTarget: `P3-Q0${startQ}-${endQ}`,
          part: 3,
          localIndex: localIdx,
          mediaType: 'audio',
        });
      }
    } else if (p3Convention === 'P3_LOCAL_INDEX') {
      const token = getLastNumericToken(f);
      if (token !== null && token >= 1 && token <= 13) {
        const startQ = 32 + (token - 1) * 3;
        const endQ = startQ + 2;
        candidateList.push({
          file: f,
          targetType: 'group',
          targetKey: `Q${startQ}–${endQ}`,
          canonicalTarget: `P3-Q0${startQ}-${endQ}`,
          part: 3,
          localIndex: token,
          mediaType: 'audio',
        });
      }
    } else if (p3Convention === 'P3_GLOBAL_STARTQ') {
      const token = getLastNumericToken(f);
      if (token !== null && token >= 32 && token <= 68) {
        const startQ = token;
        const endQ = startQ + 2;
        const localIdx = Math.floor((startQ - 32) / 3) + 1;
        candidateList.push({
          file: f,
          targetType: 'group',
          targetKey: `Q${startQ}–${endQ}`,
          canonicalTarget: `P3-Q0${startQ}-${endQ}`,
          part: 3,
          localIndex: localIdx,
          mediaType: 'audio',
        });
      }
    } else {
      // Ambiguous Part 3
      const token = getLastNumericToken(f) || 32;
      candidateList.push({
        file: f,
        targetType: 'group',
        targetKey: `Q${token}`,
        canonicalTarget: `P3-Q0${token}`,
        part: 3,
        localIndex: 1,
        mediaType: 'audio',
        isAmbiguous: true,
      });
    }
  });

  // MAPPING EXECUTION — PART 4 AUDIO
  p4Files.forEach(f => {
    if (p4Convention === 'P4_RANGE') {
      const parsed = parseGroupAudioFilename(f.name, 'p4_audio');
      if (parsed.matchType === 'range' && parsed.isValidRange && parsed.startQ !== null && parsed.endQ !== null) {
        const startQ = parsed.startQ;
        const endQ = parsed.endQ;
        const localIdx = Math.floor((startQ - 71) / 3) + 1;
        candidateList.push({
          file: f,
          targetType: 'group',
          targetKey: `Q${startQ}–${endQ}`,
          canonicalTarget: `P4-Q${startQ < 100 ? '0' : ''}${startQ}-${endQ}`,
          part: 4,
          localIndex: localIdx,
          mediaType: 'audio',
        });
      }
    } else if (p4Convention === 'P4_LOCAL_INDEX') {
      const token = getLastNumericToken(f);
      if (token !== null && token >= 1 && token <= 10) {
        const startQ = 71 + (token - 1) * 3;
        const endQ = startQ + 2;
        candidateList.push({
          file: f,
          targetType: 'group',
          targetKey: `Q${startQ}–${endQ}`,
          canonicalTarget: `P4-Q${startQ < 100 ? '0' : ''}${startQ}-${endQ}`,
          part: 4,
          localIndex: token,
          mediaType: 'audio',
        });
      }
    } else if (p4Convention === 'P4_GLOBAL_STARTQ') {
      const token = getLastNumericToken(f);
      if (token !== null && token >= 71 && token <= 98) {
        const startQ = token;
        const endQ = startQ + 2;
        const localIdx = Math.floor((startQ - 71) / 3) + 1;
        candidateList.push({
          file: f,
          targetType: 'group',
          targetKey: `Q${startQ}–${endQ}`,
          canonicalTarget: `P4-Q${startQ < 100 ? '0' : ''}${startQ}-${endQ}`,
          part: 4,
          localIndex: localIdx,
          mediaType: 'audio',
        });
      }
    } else {
      // Ambiguous Part 4
      const token = getLastNumericToken(f) || 71;
      candidateList.push({
        file: f,
        targetType: 'group',
        targetKey: `Q${token}`,
        canonicalTarget: `P4-Q${token}`,
        part: 4,
        localIndex: 1,
        mediaType: 'audio',
        isAmbiguous: true,
      });
    }
  });

  // Calculate target counts by canonicalTarget to surface conflicts accurately
  const targetCounts = new Map<string, number>();
  candidateList.forEach(c => {
    targetCounts.set(c.canonicalTarget, (targetCounts.get(c.canonicalTarget) || 0) + 1);
  });

  candidateList.forEach((c, idx) => {
    const count = targetCounts.get(c.canonicalTarget) || 0;
    const isConflict = count > 1 || Boolean(c.isAmbiguous);

    let errorMsg: string | undefined;
    if (c.isAmbiguous) {
      errorMsg = `Không xác định được cách đánh số audio Part ${c.part}. Hệ thống hỗ trợ: clip nội bộ (1-25) hoặc số câu TOEIC (7-31).`;
    } else if (count > 1) {
      errorMsg = `${c.targetKey} đang nhận nhiều file audio. Hệ thống cần đúng 1 file: Part ${c.part} clip ${c.localIndex < 10 ? '0' : ''}${c.localIndex} → ${c.targetKey}.`;
    }

    mediaEntries.push({
      id: `audio-${idx}-${c.canonicalTarget}`,
      targetType: c.targetType,
      targetNumberOrRange: c.targetKey,
      canonicalTarget: c.canonicalTarget,
      part: c.part,
      localIndex: c.localIndex,
      mediaType: 'audio',
      file: c.file,
      filename: c.file.name,
      status: isConflict ? 'conflict' : 'ready',
      error: errorMsg,
    });
  });

  const conventions: PackageMediaConventions = {
    p2Convention,
    p3Convention,
    p4Convention,
  };

  const resultList = mediaEntries as OriPackageMediaList;
  resultList.conventions = conventions;

  return resultList;
}
