// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Package Builder
// ============================================================

import { OriToeicPackageV1, RawPackageSources, OriPackageQuestion, OriPackageGroup, OriPackageAnswerEntry, getCanonicalToeicGroupType } from './types';
import { parseListeningPdfText } from './listeningParser';
import { parseReadingPdfText } from './readingParser';
import { parseAnswerKeyText } from './answerKeyParser';
import { parseTranscriptText } from './transcriptParser';
import { matchPackageMedia } from './mediaMatcher';

export function buildOriToeicPackage(sources: RawPackageSources, testTitle?: string): OriToeicPackageV1 {
  // 1. Listening Questions & Groups (Q1..Q100)
  const listeningRes = parseListeningPdfText(sources.listeningPdfText || '');
  
  // 2. Reading Questions & Groups (Q101..Q200)
  const readingRes = parseReadingPdfText(sources.readingPdfText || '');

  // Merge questions & sort by question_number
  const questionMap = new Map<number, OriPackageQuestion>();

  listeningRes.questions.forEach(q => questionMap.set(q.question_number, q));
  readingRes.questions.forEach(q => questionMap.set(q.question_number, q));

  // Ensure all 200 question slots exist
  const allQuestions: OriPackageQuestion[] = [];
  for (let qNum = 1; qNum <= 200; qNum++) {
    const existing = questionMap.get(qNum);
    if (existing) {
      allQuestions.push(existing);
    } else {
      // Fallback placeholder slot if not parsed
      let part: any = 'part1';
      if (qNum >= 7 && qNum <= 31) part = 'part2';
      else if (qNum >= 32 && qNum <= 70) part = 'part3';
      else if (qNum >= 71 && qNum <= 100) part = 'part4';
      else if (qNum >= 101 && qNum <= 130) part = 'part5';
      else if (qNum >= 131 && qNum <= 146) part = 'part6';
      else if (qNum >= 147 && qNum <= 200) part = 'part7';

      allQuestions.push({
        question_number: qNum,
        part,
        question_text: `Question ${qNum}`,
        options: [
          { label: 'A', text: 'Option A' },
          { label: 'B', text: 'Option B' },
          { label: 'C', text: 'Option C' },
          { label: 'D', text: 'Option D' },
        ],
      });
    }
  }

  // 3. Merge Groups & Ensure canonical group_type
  const allGroups: OriPackageGroup[] = [
    ...listeningRes.groups,
    ...readingRes.groups,
  ].map(g => ({
    ...g,
    group_type: g.group_type || getCanonicalToeicGroupType(g.part),
  }));

  // 4. Answer Key
  const ansRes = parseAnswerKeyText(sources.answerKeyText || '');
  const answers: OriPackageAnswerEntry[] = ansRes.answers;

  // Merge answers into questions
  const ansMap = new Map<number, 'A' | 'B' | 'C' | 'D'>();
  answers.forEach(a => ansMap.set(a.question_number, a.correct_answer));

  allQuestions.forEach(q => {
    if (ansMap.has(q.question_number)) {
      q.correct_answer = ansMap.get(q.question_number);
    }
  });

  // 5. Transcript Parsing & Merging
  if (sources.transcriptPdfText) {
    const transcriptMap = parseTranscriptText(sources.transcriptPdfText);
    allQuestions.forEach(q => {
      if (transcriptMap.questions.has(q.question_number)) {
        q.transcript = transcriptMap.questions.get(q.question_number);
      }
    });

    allGroups.forEach(g => {
      const key = `Q${g.start_question}–${g.end_question}`;
      if (transcriptMap.groups.has(key)) {
        g.transcript = transcriptMap.groups.get(key);
      }
    });
  }

  // 6. Media Matching
  const mediaEntries = matchPackageMedia(sources);

  // Attach local media files to questions / groups
  mediaEntries.forEach(m => {
    if (m.file) {
      if (m.targetType === 'question') {
        const qNum = parseInt(m.targetNumberOrRange.replace(/[^0-9]+/g, ''), 10);
        const q = allQuestions.find(x => x.question_number === qNum);
        if (q) {
          if (m.mediaType === 'image') q.local_image_file = m.file;
          if (m.mediaType === 'audio') q.local_audio_file = m.file as File;
        }
      } else if (m.targetType === 'group') {
        const match = m.targetNumberOrRange.match(/([0-9]+)[–\-]([0-9]+)/);
        if (match) {
          const startQ = parseInt(match[1], 10);
          const endQ = parseInt(match[2], 10);
          const g = allGroups.find(x => x.start_question === startQ && x.end_question === endQ);
          if (g && m.mediaType === 'audio') {
            g.local_audio_file = m.file as File;
          }
        }
      }
    }
  });

  // 7. Optional Bilingual Content JSON merge
  let bilingualPayload: OriToeicPackageV1['bilingual'] = undefined;
  if (sources.bilingualJsonText) {
    try {
      const parsedBilingual = JSON.parse(sources.bilingualJsonText);
      bilingualPayload = parsedBilingual;

      // Merge into question/group objects
      if (Array.isArray(parsedBilingual.questions)) {
        parsedBilingual.questions.forEach((biQ: any) => {
          const q = allQuestions.find(x => x.question_number === biQ.question_number);
          if (q) {
            if (biQ.translation_vi) q.translation_vi = biQ.translation_vi;
            if (Array.isArray(biQ.options_vi) && q.options) {
              biQ.options_vi.forEach((optVi: string, idx: number) => {
                if (q.options![idx]) q.options![idx].text_vi = optVi;
              });
            }
          }
        });
      }

      if (Array.isArray(parsedBilingual.groups)) {
        parsedBilingual.groups.forEach((biG: any) => {
          const g = allGroups.find(x => x.start_question === biG.start_question && x.end_question === biG.end_question);
          if (g) {
            if (biG.instruction_vi) g.instruction_vi = biG.instruction_vi;
            if (biG.passage_vi) g.passage_vi = biG.passage_vi;
          }
        });
      }
    } catch {
      // Ignored if invalid JSON
    }
  }

  const title = testTitle || `Đề thi TOEIC Import ${new Date().toLocaleDateString('vi-VN')}`;

  return {
    schema_version: 'ori.toeic.package.v1',
    test: {
      title,
      source_label: 'One-Click Import Package',
      listening_audio_mode: 'segmented',
    },
    questions: allQuestions,
    groups: allGroups,
    answers,
    media: mediaEntries,
    bilingual: bilingualPayload,
  };
}
