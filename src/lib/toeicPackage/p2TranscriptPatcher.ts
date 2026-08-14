// ============================================================
// Phase P3.5G: Part 2 Audio Transcript Patcher & Classifier Integration
// ============================================================

import { OriToeicPackageV1, OriPackageQuestion } from './types';
import { classifyPart2Question, Part2ClassificationResult } from '../toeicV2/part2Classifier';

export interface Part2TranscriptQuestionInput {
  questionNumber?: number;
  question_number?: number;
  promptText?: string;
  prompt_text?: string;
  transcript?: string;
  responses?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
  };
  responsesVi?: {
    A?: string;
    B?: string;
    C?: string;
  };
  promptVi?: string;
  translation_vi?: string;
  confidence?: number;
}

export interface Part2TranscriptPayloadInput {
  source?: string;
  questions?: Part2TranscriptQuestionInput[];
}

export interface PatchPart2TranscriptResult {
  success: boolean;
  patchedPkg: OriToeicPackageV1;
  patchedCount: number;
  errors: string[];
  warnings: string[];
  classifications: Record<number, Part2ClassificationResult>;
}

export function validateAndPatchPart2Transcripts(
  currentPkg: OriToeicPackageV1,
  transcriptJsonText: string
): PatchPart2TranscriptResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const classifications: Record<number, Part2ClassificationResult> = {};
  let patchedCount = 0;

  let parsed: any = null;
  try {
    let cleanJson = transcriptJsonText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }
    parsed = JSON.parse(cleanJson);
  } catch (err: any) {
    return {
      success: false,
      patchedPkg: currentPkg,
      patchedCount: 0,
      errors: [`Lỗi cú pháp JSON Part 2 transcript: ${err?.message || 'JSON không hợp lệ'}`],
      warnings: [],
      classifications: {},
    };
  }

  let rawQuestions: Part2TranscriptQuestionInput[] = [];
  if (Array.isArray(parsed)) {
    rawQuestions = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    if (Array.isArray(parsed.questions)) {
      rawQuestions = parsed.questions;
    }
  }

  if (rawQuestions.length === 0) {
    return {
      success: false,
      patchedPkg: currentPkg,
      patchedCount: 0,
      errors: ['Không tìm thấy danh sách câu hỏi (questions) trong gói transcript Part 2.'],
      warnings: [],
      classifications: {},
    };
  }

  const seenQNums = new Set<number>();
  const validItems: Array<{
    qNum: number;
    promptText: string;
    responses: { A: string; B: string; C: string };
    promptVi?: string;
    responsesVi?: { A?: string; B?: string; C?: string };
  }> = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const item = rawQuestions[i];
    const qNum = parseInt(String(item.questionNumber || item.question_number), 10);

    if (isNaN(qNum)) {
      errors.push(`Mục thứ ${i + 1} thiếu số câu (questionNumber).`);
      continue;
    }

    if (qNum < 7 || qNum > 31) {
      errors.push(`Câu hỏi #${qNum} nằm ngoài phạm vi Part 2 (Q7–Q31). Gói P2 transcript chỉ chấp nhận Q7–Q31.`);
      continue;
    }

    if (seenQNums.has(qNum)) {
      errors.push(`Số câu #${qNum} bị lặp lại trong gói P2 transcript.`);
      continue;
    }
    seenQNums.add(qNum);

    const promptText = (item.promptText || item.prompt_text || item.transcript || '').trim();
    if (!promptText) {
      errors.push(`Câu hỏi #${qNum} thiếu nội dung nghe câu hỏi (promptText).`);
      continue;
    }

    const resps = item.responses;
    if (!resps || typeof resps !== 'object') {
      errors.push(`Câu hỏi #${qNum} thiếu danh sách lựa chọn nghe (responses: { A, B, C }).`);
      continue;
    }

    const optA = (resps.A || '').trim();
    const optB = (resps.B || '').trim();
    const optC = (resps.C || '').trim();
    const optD = (resps.D || '').trim();

    if (optD) {
      errors.push(`Câu hỏi #${qNum} có lựa chọn D ("${optD}"). Part 2 chỉ có 3 lựa chọn A, B, C.`);
      continue;
    }

    if (!optA || !optB || !optC) {
      errors.push(`Câu hỏi #${qNum} phải có đầy đủ cả 3 lựa chọn A, B, C.`);
      continue;
    }

    validItems.push({
      qNum,
      promptText,
      responses: { A: optA, B: optB, C: optC },
      promptVi: item.promptVi || item.translation_vi,
      responsesVi: item.responsesVi,
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      patchedPkg: currentPkg,
      patchedCount: 0,
      errors,
      warnings,
      classifications: {},
    };
  }

  // Clone package questions
  const patchedQuestions: OriPackageQuestion[] = currentPkg.questions.map((q) => ({
    ...q,
    options: Array.isArray(q.options) ? q.options.map((opt) => ({ ...opt })) : q.options,
  }));

  const qMap = new Map<number, OriPackageQuestion>();
  patchedQuestions.forEach((q) => qMap.set(q.question_number, q));

  validItems.forEach((item) => {
    const targetQ = qMap.get(item.qNum);
    if (!targetQ) {
      warnings.push(`Không tìm thấy câu hỏi #${item.qNum} trong gói đề thi.`);
      return;
    }

    // Attach transcript to structured hidden field (do NOT mutate active question_text during exam)
    targetQ.transcript = item.promptText;

    // Attach full responses (A, B, C) and translation
    (targetQ as any).script_responses = item.responses;
    if (item.promptVi) {
      targetQ.translation_vi = item.promptVi;
    }
    if (item.responsesVi) {
      (targetQ as any).script_responses_vi = item.responsesVi;
    }

    // Run semantic classifier
    const classification = classifyPart2Question({
      question_number: item.qNum,
      part: 'part2',
      transcript: item.promptText,
      responses: item.responses,
      correct_answer: (targetQ.correct_answer === 'D' ? 'A' : targetQ.correct_answer) || 'A',
    });

    classifications[item.qNum] = classification;
    (targetQ as any).part2_classification = classification;

    patchedCount++;
  });

  const patchedPkg: OriToeicPackageV1 = {
    ...currentPkg,
    questions: patchedQuestions,
  };

  return {
    success: true,
    patchedPkg,
    patchedCount,
    errors: [],
    warnings,
    classifications,
  };
}

/**
 * Generate ChatGPT prompt for Part 2 audio transcript export pack
 */
export function generatePart2AudioTranscriptPrompt(): string {
  return `=== ORI TOEIC PART 2 AUDIO TRANSCRIPTION PACKET ===
SCHEMA: ori-p2-transcript-v1
TARGET: Part 2 Listening (Questions 7 to 31)

NHIỆM VỤ:
Trích xuất lời thoại tiếng Anh nghe được từ 25 clip âm thanh Part 2 (Q7 đến Q31) thành định dạng JSON chuẩn ORI.

QUY TẮC BẮT BUỘC:
1. Chỉ dành riêng cho Part 2 (Q7 đến Q31). Không chứa Q1–Q6 hoặc Q32 trở lên.
2. Mỗi câu hỏi chỉ có ĐÚNG 3 LỰA CHỌN (A), (B), (C). KHÔNG tạo lựa chọn (D).
3. "promptText": Câu hỏi/câu nói spoken nghe được trong bài.
4. "responses": Object chứa chính xác 3 câu đáp lại: {"A": "...", "B": "...", "C": "..."}.
5. Giữ nguyên số thứ tự câu hỏi Q7–Q31.
6. Trả về định dạng JSON duy nhất.

ĐỊNH DẠNG JSON MẪU:
{
  "source": "P2_AUDIO_TRANSCRIPT",
  "questions": [
    {
      "questionNumber": 7,
      "promptText": "When will the new manager arrive?",
      "responses": {
        "A": "At the main entrance.",
        "B": "Sometime this afternoon.",
        "C": "Yes, she manages it."
      }
    }
  ]
}`;
}
