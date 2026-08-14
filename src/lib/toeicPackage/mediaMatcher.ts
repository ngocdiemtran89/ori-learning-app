// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Media Matcher
// ============================================================

import { OriPackageMediaEntry, RawPackageSources } from './types';
import { isMacNoiseFile, parseGroupAudioFilename } from '../cms/sequentialMediaParser';

export function matchPackageMedia(sources: RawPackageSources): OriPackageMediaEntry[] {
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

  // 2. AUDIO FILES MATCHING
  const realAudioFiles = audioFiles.filter(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg') || name.endsWith('.m4a');
  });

  const candidateList: Array<{
    file: File;
    targetType: 'question' | 'group';
    targetKey: string;
    canonicalTarget: string;
    part: number;
    localIndex: number;
    mediaType: 'audio';
  }> = [];

  realAudioFiles.forEach(f => {
    const path = f.name.toLowerCase();
    // Strip audio extension so ".mp3" does not falsely trigger "p3" regex!
    const pathWithoutExt = path.substring(0, path.lastIndexOf('.'));
    const basename = (f.name.split('/').pop() || f.name).toLowerCase();

    // Enhanced Part Detection on pathWithoutExt (matching space, underscore, hyphen, e.g. "part 1", "part_1", "part-1", "p1")
    const isP1 = Boolean(pathWithoutExt.match(/(?:\bpart|\bp)[\s_\-]*1(?!\d)/i));
    const isP2 = Boolean(pathWithoutExt.match(/(?:\bpart|\bp)[\s_\-]*2(?!\d)/i));
    const isP3 = Boolean(pathWithoutExt.match(/(?:\bpart|\bp)[\s_\-]*3(?!\d)/i));
    const isP4 = Boolean(pathWithoutExt.match(/(?:\bpart|\bp)[\s_\-]*4(?!\d)/i));

    // A. Canonical ORI question audio (q001.mp3 .. q031.mp3)
    const oriQMatch = basename.match(/^q0*([1-9]|[12][0-9]|3[01])\.(mp3|wav|ogg|m4a)$/);
    if (oriQMatch) {
      const qNum = parseInt(oriQMatch[1], 10);
      if (qNum >= 1 && qNum <= 6) {
        candidateList.push({ file: f, targetType: 'question', targetKey: `Q${qNum}`, canonicalTarget: `P1-Q00${qNum}`, part: 1, localIndex: qNum, mediaType: 'audio' });
      } else {
        const localIdx = qNum - 6;
        candidateList.push({ file: f, targetType: 'question', targetKey: `Q${qNum}`, canonicalTarget: `P2-Q${qNum < 10 ? '00' : '0'}${qNum}`, part: 2, localIndex: localIdx, mediaType: 'audio' });
      }
      return;
    }

    // B. Canonical ORI group audio (q032-034.mp3 .. q098-100.mp3)
    const oriGMatch = basename.match(/^q0*([3-9][0-9]|100)[–\-]+0*([3-9][0-9]|100)\.(mp3|wav|ogg|m4a)$/);
    if (oriGMatch) {
      const startQ = parseInt(oriGMatch[1], 10);
      const endQ = parseInt(oriGMatch[2], 10);
      const part = startQ <= 70 ? 3 : 4;
      const localIdx = part === 3 ? Math.floor((startQ - 32) / 3) + 1 : Math.floor((startQ - 71) / 3) + 1;
      const canonicalTarget = part === 3 ? `P3-Q0${startQ}-${endQ}` : `P4-Q${startQ < 100 ? '0' : ''}${startQ}-${endQ}`;
      candidateList.push({ file: f, targetType: 'group', targetKey: `Q${startQ}–${endQ}`, canonicalTarget, part, localIndex: localIdx, mediaType: 'audio' });
      return;
    }

    // C. Native Explicit Question Range Matching for Part 3 & Part 4 (e.g. E26-T01-32-34.mp3)
    const p3GroupParsed = parseGroupAudioFilename(f.name, 'p3_audio');
    if (p3GroupParsed.matchType === 'range' && p3GroupParsed.isValidRange && p3GroupParsed.startQ !== null && p3GroupParsed.endQ !== null && !isP4) {
      const startQ = p3GroupParsed.startQ;
      const endQ = p3GroupParsed.endQ;
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
      return;
    }

    const p4GroupParsed = parseGroupAudioFilename(f.name, 'p4_audio');
    if (p4GroupParsed.matchType === 'range' && p4GroupParsed.isValidRange && p4GroupParsed.startQ !== null && p4GroupParsed.endQ !== null && !isP3) {
      const startQ = p4GroupParsed.startQ;
      const endQ = p4GroupParsed.endQ;
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
      return;
    }

    // D. Single Question Tokens (Part 1 & Part 2 & Group Fallback)
    const nameWithoutExt = basename.substring(0, basename.lastIndexOf('.'));
    const tokens = nameWithoutExt.split(/[^0-9]+/).filter(Boolean).map(t => parseInt(t, 10));

    if (tokens.length > 0) {
      const lastToken = tokens[tokens.length - 1];

      // Folder / filename hint P2
      if (isP2) {
        let qNum = lastToken;
        let localIdx = lastToken;
        if (lastToken >= 1 && lastToken <= 25) {
          localIdx = lastToken;
          qNum = 6 + lastToken;
        } else if (lastToken >= 7 && lastToken <= 31) {
          localIdx = lastToken - 6;
          qNum = lastToken;
        }

        if (qNum >= 7 && qNum <= 31) {
          const canonicalTarget = `P2-Q${qNum < 10 ? '00' : '0'}${qNum}`;
          candidateList.push({ file: f, targetType: 'question', targetKey: `Q${qNum}`, canonicalTarget, part: 2, localIndex: localIdx, mediaType: 'audio' });
          return;
        }
      }

      // Folder / filename hint P1
      if (isP1) {
        let qNum = lastToken;
        if (lastToken >= 1 && lastToken <= 6) {
          const canonicalTarget = `P1-Q00${qNum}`;
          candidateList.push({ file: f, targetType: 'question', targetKey: `Q${qNum}`, canonicalTarget, part: 1, localIndex: qNum, mediaType: 'audio' });
          return;
        }
      }

      // Folder-guided Part 3 Sequential Index (1..13)
      if (isP3 && lastToken >= 1 && lastToken <= 13) {
        const startQ = 32 + (lastToken - 1) * 3;
        const endQ = startQ + 2;
        candidateList.push({ file: f, targetType: 'group', targetKey: `Q${startQ}–${endQ}`, canonicalTarget: `P3-Q0${startQ}-${endQ}`, part: 3, localIndex: lastToken, mediaType: 'audio' });
        return;
      }

      // Folder-guided Part 4 Sequential Index (1..10)
      if (isP4 && lastToken >= 1 && lastToken <= 10) {
        const startQ = 71 + (lastToken - 1) * 3;
        const endQ = startQ + 2;
        candidateList.push({ file: f, targetType: 'group', targetKey: `Q${startQ}–${endQ}`, canonicalTarget: `P4-Q${startQ < 100 ? '0' : ''}${startQ}-${endQ}`, part: 4, localIndex: lastToken, mediaType: 'audio' });
        return;
      }

      // Default Absolute Part 2 matching (07..31)
      if (lastToken >= 7 && lastToken <= 31 && !isP1 && !isP3 && !isP4) {
        const canonicalTarget = `P2-Q${lastToken < 10 ? '00' : '0'}${lastToken}`;
        candidateList.push({ file: f, targetType: 'question', targetKey: `Q${lastToken}`, canonicalTarget, part: 2, localIndex: lastToken - 6, mediaType: 'audio' });
        return;
      }

      // Default Absolute Part 1 matching (01..06)
      if (lastToken >= 1 && lastToken <= 6 && !isP2 && !isP3 && !isP4) {
        const canonicalTarget = `P1-Q00${lastToken}`;
        candidateList.push({ file: f, targetType: 'question', targetKey: `Q${lastToken}`, canonicalTarget, part: 1, localIndex: lastToken, mediaType: 'audio' });
        return;
      }
    }
  });

  // Calculate target counts by canonicalTarget to surface conflicts accurately
  const targetCounts = new Map<string, number>();
  candidateList.forEach(c => {
    targetCounts.set(c.canonicalTarget, (targetCounts.get(c.canonicalTarget) || 0) + 1);
  });

  candidateList.forEach((c, idx) => {
    const isConflict = (targetCounts.get(c.canonicalTarget) || 0) > 1;
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
      error: isConflict
        ? `${c.targetKey} đang nhận nhiều file audio. Hệ thống cần đúng 1 file: Part ${c.part} clip ${c.localIndex < 10 ? '0' : ''}${c.localIndex} → ${c.targetKey}.`
        : undefined,
    });
  });

  return mediaEntries;
}
