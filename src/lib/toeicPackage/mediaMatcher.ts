// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Media Matcher
// ============================================================

import { OriPackageMediaEntry, RawPackageSources } from './types';
import { isMacNoiseFile, parseGroupAudioFilename } from '../cms/sequentialMediaParser';

export function matchPackageMedia(sources: RawPackageSources): OriPackageMediaEntry[] {
  const mediaEntries: OriPackageMediaEntry[] = [];
  const audioFiles = (sources.audioFiles || []).filter(f => !isMacNoiseFile(f.name));

  // 1. PART 1 IMAGES
  const p1CroppedMap = sources.part1PdfCroppedImages || {};
  for (let qNum = 1; qNum <= 6; qNum++) {
    const croppedBlob = p1CroppedMap[qNum];
    if (croppedBlob) {
      mediaEntries.push({
        id: `p1-img-q${qNum}`,
        targetType: 'question',
        targetNumberOrRange: `Q${qNum}`,
        mediaType: 'image',
        file: croppedBlob,
        filename: `p1_q${qNum}_cropped.png`,
        status: 'ready',
      });
    }
  }

  const imageFiles = audioFiles.filter(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
  });

  const p1ImgTargetMap = new Map<number, File>();
  imageFiles.forEach(f => {
    const basename = (f.name.split('/').pop() || f.name).toLowerCase();
    const match = basename.match(/(?:q|p1_)?0*([1-6])\.(jpg|jpeg|png|webp)$/i);
    if (match) {
      const qNum = parseInt(match[1], 10);
      p1ImgTargetMap.set(qNum, f);
    }
  });

  for (let qNum = 1; qNum <= 6; qNum++) {
    if (!mediaEntries.some(m => m.targetNumberOrRange === `Q${qNum}` && m.mediaType === 'image')) {
      const imgFile = p1ImgTargetMap.get(qNum);
      if (imgFile) {
        mediaEntries.push({
          id: `p1-img-file-q${qNum}`,
          targetType: 'question',
          targetNumberOrRange: `Q${qNum}`,
          mediaType: 'image',
          file: imgFile,
          filename: imgFile.name,
          status: 'ready',
        });
      }
    }
  }

  // 2. AUDIO FILES MATCHING
  const realAudioFiles = audioFiles.filter(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg') || name.endsWith('.m4a');
  });

  const targetCounts = new Map<string, number>();

  const candidateList: Array<{
    file: File;
    targetType: 'question' | 'group';
    targetKey: string;
    mediaType: 'audio';
  }> = [];

  realAudioFiles.forEach(f => {
    const path = f.name.toLowerCase();
    const basename = (f.name.split('/').pop() || f.name).toLowerCase();

    // Fix: strict folder path hints to avoid matching ".mp3" extension as "p3"
    const isP1 = path.includes('part 1') || path.includes('part1') || path.includes('/p1/') || path.includes('_p1_');
    const isP2 = path.includes('part 2') || path.includes('part2') || path.includes('/p2/') || path.includes('_p2_');
    const isP3 = path.includes('part 3') || path.includes('part3') || path.includes('/p3/') || path.includes('_p3_');
    const isP4 = path.includes('part 4') || path.includes('part4') || path.includes('/p4/') || path.includes('_p4_');

    // A. Canonical ORI question audio (q001.mp3 .. q031.mp3)
    const oriQMatch = basename.match(/^q0*([1-9]|[12][0-9]|3[01])\.(mp3|wav|ogg|m4a)$/);
    if (oriQMatch) {
      const qNum = parseInt(oriQMatch[1], 10);
      candidateList.push({ file: f, targetType: 'question', targetKey: `Q${qNum}`, mediaType: 'audio' });
      return;
    }

    // B. Canonical ORI group audio (q032-034.mp3 .. q098-100.mp3)
    const oriGMatch = basename.match(/^q0*([3-9][0-9]|100)-0*([3-9][0-9]|100)\.(mp3|wav|ogg|m4a)$/);
    if (oriGMatch) {
      const startQ = parseInt(oriGMatch[1], 10);
      const endQ = parseInt(oriGMatch[2], 10);
      candidateList.push({ file: f, targetType: 'group', targetKey: `Q${startQ}–${endQ}`, mediaType: 'audio' });
      return;
    }

    // C. Native Explicit Question Range Matching for Part 3 & Part 4 (e.g. E26-T01-32-34.mp3)
    const p3GroupParsed = parseGroupAudioFilename(f.name, 'p3_audio');
    if (p3GroupParsed.matchType === 'range' && p3GroupParsed.isValidRange && p3GroupParsed.startQ !== null && p3GroupParsed.endQ !== null && !isP4) {
      candidateList.push({
        file: f,
        targetType: 'group',
        targetKey: `Q${p3GroupParsed.startQ}–${p3GroupParsed.endQ}`,
        mediaType: 'audio',
      });
      return;
    }

    const p4GroupParsed = parseGroupAudioFilename(f.name, 'p4_audio');
    if (p4GroupParsed.matchType === 'range' && p4GroupParsed.isValidRange && p4GroupParsed.startQ !== null && p4GroupParsed.endQ !== null && !isP3) {
      candidateList.push({
        file: f,
        targetType: 'group',
        targetKey: `Q${p4GroupParsed.startQ}–${p4GroupParsed.endQ}`,
        mediaType: 'audio',
      });
      return;
    }

    // D. Single Question Tokens (Part 1 & Part 2)
    const nameWithoutExt = basename.substring(0, basename.lastIndexOf('.'));
    const tokens = nameWithoutExt.split(/[^0-9]+/).filter(Boolean).map(t => parseInt(t, 10));

    if (tokens.length > 0) {
      const lastToken = tokens[tokens.length - 1];

      // Folder hint P2
      if (isP2) {
        let qNum = lastToken;
        if (lastToken >= 1 && lastToken <= 25) qNum = 6 + lastToken;
        if (qNum >= 7 && qNum <= 31) {
          candidateList.push({ file: f, targetType: 'question', targetKey: `Q${qNum}`, mediaType: 'audio' });
          return;
        }
      }

      // Folder hint P1
      if (isP1 && lastToken >= 1 && lastToken <= 6) {
        candidateList.push({ file: f, targetType: 'question', targetKey: `Q${lastToken}`, mediaType: 'audio' });
        return;
      }

      // Default Absolute Part 2 matching (07..31)
      if (lastToken >= 7 && lastToken <= 31) {
        candidateList.push({ file: f, targetType: 'question', targetKey: `Q${lastToken}`, mediaType: 'audio' });
        return;
      }

      // Default Part 1 matching (01..06)
      if (lastToken >= 1 && lastToken <= 6) {
        candidateList.push({ file: f, targetType: 'question', targetKey: `Q${lastToken}`, mediaType: 'audio' });
        return;
      }

      // Folder-guided Part 3 / Part 4 Sequential Index Fallback
      if (isP3 && lastToken >= 1 && lastToken <= 13) {
        const startQ = 32 + (lastToken - 1) * 3;
        candidateList.push({ file: f, targetType: 'group', targetKey: `Q${startQ}–${startQ + 2}`, mediaType: 'audio' });
        return;
      }

      if (isP4 && lastToken >= 1 && lastToken <= 10) {
        const startQ = 71 + (lastToken - 1) * 3;
        candidateList.push({ file: f, targetType: 'group', targetKey: `Q${startQ}–${startQ + 2}`, mediaType: 'audio' });
        return;
      }
    }
  });

  candidateList.forEach(c => {
    targetCounts.set(c.targetKey, (targetCounts.get(c.targetKey) || 0) + 1);
  });

  candidateList.forEach((c, idx) => {
    const isConflict = (targetCounts.get(c.targetKey) || 0) > 1;
    mediaEntries.push({
      id: `audio-${idx}-${c.targetKey}`,
      targetType: c.targetType,
      targetNumberOrRange: c.targetKey,
      mediaType: 'audio',
      file: c.file,
      filename: c.file.name,
      status: isConflict ? 'conflict' : 'ready',
      error: isConflict ? `Phát hiện nhiều file media cùng gán vào ${c.targetKey}` : undefined,
    });
  });

  return mediaEntries;
}
