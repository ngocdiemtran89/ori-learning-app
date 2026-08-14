// ============================================================
// Phase P3.5H: Part 2 Audio Transcript Pack Exporter (Binary ZIP + Manifest)
// ============================================================

import JSZip from 'jszip';
import { getLastNumericToken, detectP2NumberingConvention } from './mediaMatcher';
import { generatePart2AudioTranscriptPrompt } from './p2TranscriptPatcher';

export interface ExportP2AudioPackResult {
  zipBlob: Blob;
  mappedCount: number;
  missingCount: number;
  duplicateCount: number;
  isCanonical: boolean;
  fileList: string[];
}

/**
 * Export a zip package containing actual 25 Part 2 MP3 binaries (Q07.mp3 .. Q31.mp3),
 * manifest.json, and transcription_instructions.md.
 */
export async function exportPart2AudioTranscriptPackZip(
  audioFiles: File[],
  testTitle: string = 'ORI TOEIC Test'
): Promise<ExportP2AudioPackResult> {
  const zip = new JSZip();

  // Filter Part 2 audio files using filename matching (e.g. "Part 2", "p2", or numbers 7..31)
  const p2CandidateFiles = audioFiles.filter((f) => {
    const name = f.name.toLowerCase();
    if (name.includes('part 2') || name.includes('part2') || name.includes('_p2_') || name.includes('p2_')) {
      return true;
    }
    const token = getLastNumericToken(f);
    return token !== null && ((token >= 7 && token <= 31) || (token >= 1 && token <= 25));
  });

  const convention = detectP2NumberingConvention(p2CandidateFiles);

  const mappedFilesMap = new Map<number, File>();
  let duplicateCount = 0;

  p2CandidateFiles.forEach((file) => {
    const token = getLastNumericToken(file);
    if (token === null) return;

    let qNum: number | null = null;
    if (convention === 'P2_GLOBAL_QNUM' || (token >= 7 && token <= 31)) {
      qNum = token;
    } else if (convention === 'P2_LOCAL_INDEX' || (token >= 1 && token <= 25)) {
      qNum = token + 6; // Local index 1..25 => global Q7..Q31
    }

    if (qNum !== null && qNum >= 7 && qNum <= 31) {
      if (mappedFilesMap.has(qNum)) {
        duplicateCount++;
      } else {
        mappedFilesMap.set(qNum, file);
      }
    }
  });

  const audioFolder = zip.folder('audio');
  const fileList: string[] = [];

  for (let q = 7; q <= 31; q++) {
    const file = mappedFilesMap.get(q);
    const qStr = String(q).padStart(2, '0');
    const zipPath = `audio/Q${qStr}.mp3`;

    if (file && audioFolder) {
      const arrayBuffer = await file.arrayBuffer();
      audioFolder.file(`Q${qStr}.mp3`, arrayBuffer);
      fileList.push(zipPath);
    }
  }

  const mappedCount = mappedFilesMap.size;
  const missingCount = 25 - mappedCount;
  const isCanonical = mappedCount === 25 && duplicateCount === 0;

  // Add Manifest JSON
  const manifest = {
    schema: 'ori-p2-audio-pack-v1',
    testTitle,
    questionsCount: 25,
    canonicalRange: 'Q7-Q31',
    mappedCount,
    missingCount,
    duplicateCount,
    files: Array.from(mappedFilesMap.entries()).map(([qNum, file]) => ({
      questionNumber: qNum,
      originalFilename: file.name,
      zipPath: `audio/Q${String(qNum).padStart(2, '0')}.mp3`,
      sizeBytes: file.size,
    })),
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Add Transcription Instructions & Master Prompt
  const instructions = `# ORI TOEIC PART 2 AUDIO TRANSCRIPTION PACK INSTRUCTIONS

Test Title: ${testTitle}
Target Questions: Q7 - Q31 (25 Audio Clips)

${generatePart2AudioTranscriptPrompt()}
`;

  zip.file('transcription_instructions.md', instructions);
  fileList.push('manifest.json');
  fileList.push('transcription_instructions.md');

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  return {
    zipBlob,
    mappedCount,
    missingCount,
    duplicateCount,
    isCanonical,
    fileList,
  };
}
