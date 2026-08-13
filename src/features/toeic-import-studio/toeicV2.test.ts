// ============================================================
// ORI TOEIC Website V2 — Security & Regression Test Suite
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { validateV2Package } from '../../lib/toeicV2/validatePackage';
import { normalizeToeicOptions } from '../../lib/toeicV2/optionNormalizer';
import { convertV2ToCoreDraftPayload } from '../../lib/toeicV2/draftAdapter';
import { extractLearningUnitsFromV2Package } from '../../lib/toeicV2/extractLearningUnits';
import { buildLearningImportPayload } from '../../lib/toeicV2/buildLearningImportPayload';
import { importV2ToeicPackage } from '../../lib/toeicV2/importCoordinator';
import { OriToeicV2Package, V2Question, V2Group } from '../../lib/toeicV2/types';

// Mock Supabase client for testing
vi.mock('../../lib/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      rpc: vi.fn((funcName: string) => {
        if (funcName === 'admin_create_toeic_test_with_content') {
          return Promise.resolve({ data: { success: true, test_id: 'mock-test-uuid' }, error: null });
        }
        if (funcName === 'admin_import_v2_question_learning_links') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        if (funcName === 'student_get_safe_v2_practice_questions') {
          return Promise.resolve({
            data: [
              {
                question_id: 'q1',
                test_id: 't1',
                question_number: 1,
                part: 'P1',
                question_text: 'Sample Q',
                options: ['(A) a', '(B) b'],
                audio_url: 'sample.mp3',
                image_url: null,
                group_title: null,
                group_passage: null,
                documents: [],
              },
            ],
            error: null,
          });
        }
        if (funcName === 'student_check_v2_practice_answer') {
          return Promise.resolve({
            data: {
              success: true,
              is_correct: true,
              correct_answer: 'A',
              explanation: 'Sample explanation',
              transcript: 'Sample transcript',
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    },
  };
});

function createValid200QuestionV2Package(): OriToeicV2Package {
  const questions: V2Question[] = [];
  const groups: V2Group[] = [];

  // P1: Q1-6
  for (let i = 1; i <= 6; i++) {
    questions.push({
      question_number: i,
      part: 'P1',
      options: ['(A) A', '(B) B', '(C) C', '(D) D'],
      correct_answer: 'A',
      question_text: `P1 Q${i}`,
    });
  }

  // P2: Q7-31 (25 questions, A-C options only)
  for (let i = 7; i <= 31; i++) {
    questions.push({
      question_number: i,
      part: 'P2',
      options: ['(A) A', '(B) B', '(C) C'],
      correct_answer: 'A',
      question_text: `P2 Q${i}`,
    });
  }

  // P3: Q32-70 (39 questions, 13 groups x 3)
  for (let g = 1; g <= 13; g++) {
    const groupKey = `p3_grp_${g}`;
    groups.push({
      group_key: groupKey,
      part: 'P3',
      title: `P3 Group ${g}`,
      passage: `Passage for P3 Group ${g}`,
    });
    for (let q = 0; q < 3; q++) {
      const qNum = 32 + (g - 1) * 3 + q;
      questions.push({
        question_number: qNum,
        part: 'P3',
        group_key: groupKey,
        options: ['(A) A', '(B) B', '(C) C', '(D) D'],
        correct_answer: 'B',
      });
    }
  }

  // P4: Q71-100 (30 questions, 10 groups x 3)
  for (let g = 1; g <= 10; g++) {
    const groupKey = `p4_grp_${g}`;
    groups.push({
      group_key: groupKey,
      part: 'P4',
      title: `P4 Group ${g}`,
      passage: `Talk for P4 Group ${g}`,
    });
    for (let q = 0; q < 3; q++) {
      const qNum = 71 + (g - 1) * 3 + q;
      questions.push({
        question_number: qNum,
        part: 'P4',
        group_key: groupKey,
        options: ['(A) A', '(B) B', '(C) C', '(D) D'],
        correct_answer: 'C',
      });
    }
  }

  // P5: Q101-130 (30 questions)
  for (let i = 101; i <= 130; i++) {
    questions.push({
      question_number: i,
      part: 'P5',
      options: ['(A) A', '(B) B', '(C) C', '(D) D'],
      correct_answer: 'D',
    });
  }

  // P6: Q131-146 (16 questions, 4 groups x 4)
  for (let g = 1; g <= 4; g++) {
    const groupKey = `p6_grp_${g}`;
    groups.push({
      group_key: groupKey,
      part: 'P6',
      title: `P6 Group ${g}`,
      passage: `Passage for P6 Group ${g}`,
    });
    for (let q = 0; q < 4; q++) {
      const qNum = 131 + (g - 1) * 4 + q;
      questions.push({
        question_number: qNum,
        part: 'P6',
        group_key: groupKey,
        options: ['(A) A', '(B) B', '(C) C', '(D) D'],
        correct_answer: 'A',
      });
    }
  }

  // P7: Q147-200 (54 questions, all grouped)
  const p7Group = 'p7_grp_1';
  groups.push({
    group_key: p7Group,
    part: 'P7',
    title: 'P7 Group 1',
    passage: 'Reading comprehension text',
  });
  for (let i = 147; i <= 200; i++) {
    questions.push({
      question_number: i,
      part: 'P7',
      group_key: p7Group,
      options: ['(A) A', '(B) B', '(C) C', '(D) D'],
      correct_answer: 'A',
    });
  }

  return {
    metadata: {
      title: 'Valid 200 TOEIC V2 Test',
      slug: 'valid-200-toeic-v2-test',
      is_published: true, // Should be forced to false/draft in adapter
    },
    groups,
    questions,
  };
}

describe('ORI TOEIC Website V2 Core & Security Integration Tests', () => {
  it('1. Chấp nhận gói V2 200 câu hợp lệ', () => {
    const pkg = createValid200QuestionV2Package();
    const report = validateV2Package(pkg);
    expect(report.isValid).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.summary.totalQuestions).toBe(200);
  });

  it('2. Chặn gói câu hỏi bị thiếu hoặc trùng lặp', () => {
    const pkg = createValid200QuestionV2Package();
    pkg.questions.pop(); // Only 199 questions
    const report = validateV2Package(pkg);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.code === 'INVALID_QUESTION_COUNT')).toBe(true);
  });

  it('3. Chặn câu hỏi bị gán sai Part', () => {
    const pkg = createValid200QuestionV2Package();
    pkg.questions[0].part = 'P2'; // Q1 is in P1 range but has part P2
    const report = validateV2Package(pkg);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.code === 'WRONG_PART_MAPPING')).toBe(true);
  });

  it('4. Chặn câu Part 2 có đáp án D', () => {
    const pkg = createValid200QuestionV2Package();
    pkg.questions[6].correct_answer = 'D'; // Q7 is Part 2
    const report = validateV2Package(pkg);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.code === 'P2_NO_D_ANSWER')).toBe(true);
  });

  it('5. Chặn group_key không hợp lệ hoặc không tồn tại', () => {
    const pkg = createValid200QuestionV2Package();
    pkg.questions[31].group_key = 'non_existent_group'; // Q32 in P3
    const report = validateV2Package(pkg);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.code === 'UNRESOLVED_GROUP_KEY')).toBe(true);
  });

  it('6. Chặn sai số lượng câu hoặc range của P3 / P4 / P6', () => {
    const pkg = createValid200QuestionV2Package();
    pkg.groups[0].part = 'P3';
    // Move one question away from P3 group 1
    pkg.questions[31].group_key = 'p3_grp_2';
    const report = validateV2Package(pkg);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.code === 'P3_GROUP_SIZE')).toBe(true);
  });

  it('7. Chặn media chứa base64 / data URI', () => {
    const pkg = createValid200QuestionV2Package();
    pkg.questions[0].audio_url = 'data:audio/mp3;base64,SGVsbG8=';
    const report = validateV2Package(pkg);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.code === 'BASE64_MEDIA_BLOCKED')).toBe(true);
  });

  it('8. Chặn trùng lặp cue target', () => {
    const pkg = createValid200QuestionV2Package();
    pkg.questions[0].cue_target = 'cue_1';
    pkg.questions[1].cue_target = 'cue_1';
    const report = validateV2Package(pkg);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.code === 'DUPLICATE_CUE_TARGET')).toBe(true);
  });

  it('9. V2 import LUÔN LUÔN tạo bản nháp (draft) kể cả khi input JSON có ghi published', () => {
    const pkg = createValid200QuestionV2Package();
    pkg.metadata.is_published = true;
    pkg.metadata.status = 'published';

    const draft = convertV2ToCoreDraftPayload(pkg);
    expect(draft.metadata.title).toBe('Valid 200 TOEIC V2 Test');
  });

  it('10. Lỗi learning import vẫn giữ lại khung đề Core DRAFT', async () => {
    const pkg = createValid200QuestionV2Package();
    const res = await importV2ToeicPackage(pkg, { isDryRun: false });
    expect(res.success).toBe(true);
    expect(res.testId).toBe('mock-test-uuid');
  });

  it('11. normalizeToeicOptions("Beta") KHÔNG bị nuốt chữ B và giữ nguyên chuỗi', () => {
    const opts = normalizeToeicOptions(['Beta', 'Gamma', 'Delta', 'Alpha']);
    expect(opts[0]).toBe('(A) Beta');
    expect(opts[1]).toBe('(B) Gamma');
    expect(opts[2]).toBe('(C) Delta');
    expect(opts[3]).toBe('(D) Alpha');
  });

  it('12. Trích xuất Learning Units từ V2 Package hoạt động chính xác', () => {
    const pkg = createValid200QuestionV2Package();
    pkg.questions[100].learning_units = [
      {
        kind: 'grammar',
        item_key: 'gram_passive',
        title: 'Passive Voice',
        definition: 'Câu bị động',
      },
    ];

    const extracted = extractLearningUnitsFromV2Package(pkg);
    expect(extracted.items).toHaveLength(1);
    expect(extracted.items[0].item_key).toBe('gram_passive');
    expect(extracted.links).toHaveLength(1);
    expect(extracted.links[0].question_number).toBe(101);
  });

  it('13. Build learning import payload tạo đúng cấu trúc', () => {
    const extracted = {
      items: [
        {
          kind: 'vocabulary' as const,
          item_key: 'vocab_predict',
          title: 'Predict',
          definition: 'Dự đoán',
          example: 'Predict outcomes',
          difficulty_level: 3,
        },
      ],
      links: [
        {
          question_number: 101,
          item_key: 'vocab_predict',
          kind: 'vocabulary',
          ai_suggested: true,
        },
      ],
    };

    const payload = buildLearningImportPayload('test-uuid-1', extracted);
    expect(payload.itemsPayload).toHaveLength(1);
    expect(payload.itemsPayload[0].item_key).toBe('vocab_predict');
    expect(payload.linksPayload[0].test_id).toBe('test-uuid-1');
  });
});
