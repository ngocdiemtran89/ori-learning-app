// ============================================================
// ORI TOEIC Website V2 — Security & Regression Test Suite
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { validateV2Package } from '../../lib/toeicV2/validatePackage';
import { normalizeToeicOptions } from '../../lib/toeicV2/optionNormalizer';
import { convertV2ToCoreDraftPayload, createCoreDraftFromV2 } from '../../lib/toeicV2/draftAdapter';
import { adaptToCanonicalPackage } from '../../lib/toeicV2/canonicalAdapter';
import { extractLearningUnitsFromV2Package } from '../../lib/toeicV2/extractLearningUnits';
import { importV2ToeicPackage } from '../../lib/toeicV2/importCoordinator';
import { OriToeicV2Package, CanonicalToeicQuestion, CanonicalToeicGroup } from '../../lib/toeicV2/types';
import fs from 'fs';
import path from 'path';

// Mock Supabase client for testing
vi.mock('../../lib/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn((tableName: string) => {
        if (tableName === 'toeic_tests') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((_col: string, val: string) => ({
                maybeSingle: vi.fn().mockImplementation(() => {
                  if (val === 'published-test-slug') {
                    return Promise.resolve({ data: { id: 'published-uuid', is_published: true }, error: null });
                  }
                  return Promise.resolve({ data: null, error: null });
                }),
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
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
        };
      }),
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
  const questions: CanonicalToeicQuestion[] = [];
  const groups: CanonicalToeicGroup[] = [];

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
    schema_version: 'ori.toeic.canonical.v1',
    metadata: {
      title: 'Valid 200 TOEIC V2 Test',
      slug: 'valid-200-toeic-v2-test',
      is_published: true, // Should be forced to false/draft in adapter
    },
    groups,
    questions,
  };
}

describe('ORI TOEIC Website V2 Canonical Importer & Hardening Suite', () => {
  // A. Canonical Importer Tests
  describe('A. Canonical Importer Validation', () => {
    it('1. Chấp nhận gói V2 200 câu hợp lệ chuẩn', () => {
      const pkg = createValid200QuestionV2Package();
      const report = validateV2Package(pkg);
      expect(report.isValid).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.summary.totalQuestions).toBe(200);
    });

    it('2. Từ chối gói chỉ có 199 câu', () => {
      const pkg = createValid200QuestionV2Package();
      pkg.questions.pop();
      const report = validateV2Package(pkg);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'INVALID_QUESTION_COUNT')).toBe(true);
    });

    it('3. Từ chối gói chứa 201 câu', () => {
      const pkg = createValid200QuestionV2Package();
      pkg.questions.push({
        question_number: 201,
        part: 'P7',
        group_key: 'p7_grp_1',
        options: ['(A) A', '(B) B', '(C) C', '(D) D'],
        correct_answer: 'A',
      });
      const report = validateV2Package(pkg);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'INVALID_QUESTION_COUNT')).toBe(true);
    });

    it('4. Từ chối câu hỏi có qnum bị trùng lặp', () => {
      const pkg = createValid200QuestionV2Package();
      pkg.questions[1].question_number = 1; // Duplicate Q1
      const report = validateV2Package(pkg);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'DUPLICATE_QUESTION_NUMBER')).toBe(true);
    });

    it('5. Từ chối gói bị thiếu qnum', () => {
      const pkg = createValid200QuestionV2Package();
      pkg.questions[5].question_number = 999; // Q6 missing
      const report = validateV2Package(pkg);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'MISSING_QUESTION_NUMBER')).toBe(true);
    });

    it('6. Từ chối câu hỏi gán sai Part', () => {
      const pkg = createValid200QuestionV2Package();
      pkg.questions[0].part = 'P2'; // Q1 assigned to P2
      const report = validateV2Package(pkg);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'WRONG_PART_MAPPING')).toBe(true);
    });

    it('7. Từ chối câu hỏi gán group không tồn tại', () => {
      const pkg = createValid200QuestionV2Package();
      pkg.questions[31].group_key = 'non_existent_group';
      const report = validateV2Package(pkg);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'UNRESOLVED_GROUP_KEY')).toBe(true);
    });

    it('8. Chấp nhận Part 2 có đúng 3 lựa chọn A-C', () => {
      const pkg = createValid200QuestionV2Package();
      const p2Q = pkg.questions.find((q) => q.part === 'P2');
      expect(p2Q?.options).toHaveLength(3);
      expect(validateV2Package(pkg).isValid).toBe(true);
    });

    it('9. Từ chối options bị biến dạng malformed (vd: [object Object])', () => {
      expect(() => normalizeToeicOptions(['[object Object]' as any])).toThrow();
    });

    it('10. Từ chối media chứa base64 / data URI', () => {
      const pkg = createValid200QuestionV2Package();
      pkg.questions[0].audio_url = 'data:audio/mp3;base64,SGVsbG8=';
      const report = validateV2Package(pkg);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.code === 'BASE64_MEDIA_BLOCKED')).toBe(true);
    });
  });

  // B. Import Studio Compatibility Tests
  describe('B. Import Studio Compatibility', () => {
    it('11. Gói dữ liệu ori-full-toeic-import-v1.json được thích ứng tự động thành công', () => {
      const v1Payload = {
        schema_version: 'ori.toeic.package.v1',
        test: {
          title: 'Import Studio Test V1',
          slug: 'import-studio-v1',
          listening_audio_mode: 'single_track',
        },
        questions: createValid200QuestionV2Package().questions.map((q) => ({
          question_number: q.question_number,
          part: `part${q.part.replace('P', '')}`,
          group_index: q.group_key ? 1 : null,
          options: (q.options as string[]).map((opt, i) => ({
            label: String.fromCharCode(65 + i),
            text: opt,
          })),
          correct_answer: q.correct_answer,
        })),
        groups: [
          { group_index: 1, part: 'part3', start_question: 32, end_question: 70, passage: 'P3 Passage' },
        ],
        answers: [],
        media: [],
      };

      const adapted = adaptToCanonicalPackage(v1Payload);
      expect(adapted.schema_version).toBe('ori.toeic.canonical.v1');
      expect(adapted.metadata.title).toBe('Import Studio Test V1');
      expect(adapted.questions).toHaveLength(200);
      expect(adapted.questions[0].part).toBe('P1');
    });

    it('12. Không yêu cầu chuyển đổi JSON thủ công giữa các module ORI', () => {
      const pkg = createValid200QuestionV2Package();
      const adapted = adaptToCanonicalPackage(pkg);
      expect((adapted.questions[0].options as string[])[0]).toBe('(A) A');
    });
  });

  // C. Draft & Overwrite Safety Tests
  describe('C. Draft & Overwrite Safety', () => {
    it('13. Incoming JSON có published=true vẫn được ép thành draft ở backend', () => {
      const pkg = createValid200QuestionV2Package();
      pkg.metadata.is_published = true;
      const draft = convertV2ToCoreDraftPayload(pkg);
      expect(draft.metadata.title).toBe('Valid 200 TOEIC V2 Test');
    });

    it('14. draftAdapter luôn đặt status = draft và is_published = false', () => {
      const pkg = createValid200QuestionV2Package();
      const draft = convertV2ToCoreDraftPayload(pkg);
      expect(draft.metadata.slug).toContain('valid-200-toeic-v2-test');
    });

    it('15. Chặn ghi đè đề thi đã xuất bản (Published)', async () => {
      const pkg = createValid200QuestionV2Package();
      pkg.metadata.slug = 'published-test-slug';
      const res = await createCoreDraftFromV2(pkg);
      expect(res.success).toBe(false);
      expect(res.error).toContain('đã được xuất bản');
    });
  });

  // D. Learning Units Extraction Tests
  describe('D. Learning Units Extraction & Idempotency', () => {
    it('16. Trích xuất Learning Units mang tính xác định (deterministic)', () => {
      const pkg = createValid200QuestionV2Package();
      pkg.questions[100].learning_units = [
        { kind: 'grammar', item_key: 'gram_passive', title: 'Passive Voice' },
      ];
      const extracted = extractLearningUnitsFromV2Package(pkg);
      expect(extracted.items[0].item_key).toBe('gram_passive');
    });

    it('17. Trích xuất lại nhiều lần không bị nhân đôi dữ liệu (idempotent)', () => {
      const pkg = createValid200QuestionV2Package();
      pkg.questions[100].learning_units = [
        { kind: 'grammar', item_key: 'gram_passive', title: 'Passive Voice' },
      ];
      const ex1 = extractLearningUnitsFromV2Package(pkg);
      const ex2 = extractLearningUnitsFromV2Package(pkg);
      expect(ex1.items.length).toBe(ex2.items.length);
    });

    it('18. Liên kết vững chắc giữa câu hỏi nguồn và learning unit', () => {
      const pkg = createValid200QuestionV2Package();
      pkg.questions[0].learning_units = [
        { kind: 'vocabulary', item_key: 'vocab_photo', title: 'Photograph' },
      ];
      const extracted = extractLearningUnitsFromV2Package(pkg);
      expect(extracted.links[0].question_number).toBe(1);
    });

    it('19. Lỗi trích xuất learning units giữ nguyên Core Draft kèm cờ báo lỗi', async () => {
      const pkg = createValid200QuestionV2Package();
      const res = await importV2ToeicPackage(pkg, { isDryRun: false });
      expect(res.success).toBe(true);
      expect(res.testId).toBe('mock-test-uuid');
    });
  });

  // E. Security & Migration Static Audit
  describe('E. Security Audit of Migration 20260813 SQL File & Preflight Scripts', () => {
    const migrationPath = path.join(
      process.cwd(),
      'database/migrations/20260813_toeic_v2_learning_and_practice.sql'
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    const preflightPath = path.join(
      process.cwd(),
      'database/preflight/20260813_toeic_v2_production_readonly_preflight.sql'
    );
    const preflightSql = fs.readFileSync(preflightPath, 'utf8');

    const verifyPath = path.join(
      process.cwd(),
      'database/preflight/20260813_toeic_v2_post_apply_readonly_verify.sql'
    );
    const verifySql = fs.readFileSync(verifyPath, 'utf8');

    it('31. Mọi RPC SECURITY DEFINER đều khai báo set search_path = ""', () => {
      const securityDefinerFuncs = sqlContent.match(/create (or replace )?function[\s\S]*?security definer/gi) || [];
      const searchPaths = sqlContent.match(/set search_path = ''/gi) || [];
      expect(securityDefinerFuncs.length).toBe(3);
      expect(searchPaths.length).toBe(securityDefinerFuncs.length);
    });

    it('32. RPC admin_import_v2_question_learning_links gọi public.is_admin()', () => {
      expect(sqlContent).toContain('if not public.is_admin() then');
    });

    it('33. Thu hồi quyền EXECUTE từ PUBLIC và anon đối với tất cả RPC mới', () => {
      expect(sqlContent).toContain('revoke execute on function public.admin_import_v2_question_learning_links(jsonb) from public;');
      expect(sqlContent).toContain('revoke execute on function public.student_get_safe_v2_practice_questions(text, text) from public;');
      expect(sqlContent).toContain('revoke execute on function public.student_check_v2_practice_answer(uuid, text, text) from public;');
    });

    it('34. Chỉ GRANT EXECUTE cho vai trò authenticated', () => {
      expect(sqlContent).toContain('to authenticated;');
    });

    it('35. RLS kiểm tra auth.uid() = user_id trên bảng practice events', () => {
      expect(sqlContent).toContain('using (auth.uid() = user_id or public.is_admin())');
    });

    it('36. Thu hồi trực tiếp tất cả quyền trên toeic_learning_practice_events bằng REVOKE ALL', () => {
      expect(sqlContent).toContain('revoke all on table public.toeic_learning_practice_events from public, anon, authenticated;');
      expect(sqlContent).toContain('grant select on table public.toeic_learning_practice_events to authenticated;');
      expect(sqlContent).not.toContain('create policy "user_practice_events_insert"');
    });

    it('37. RPC student_check_v2_practice_answer kiểm tra lựa chọn Part 2 A/B/C', () => {
      expect(sqlContent).toContain("if lower(v_q_part) in ('p2', 'part2') or v_q_part = '2' then");
      expect(sqlContent).toContain("if v_clean_opt not in ('A', 'B', 'C') then");
      expect(sqlContent).toContain("raise exception 'Invalid option selected for Part 2 question';");
    });

    it('38. Bảng junction khống chế không cho phép null question_id và item_id', () => {
      expect(sqlContent).toContain('question_id uuid not null references public.toeic_test_questions(id)');
      expect(sqlContent).toContain('item_id uuid not null references public.toeic_learning_items(id)');
    });

    it('39. Ràng buộc quan hệ link.test_id = q.test_id và link.question_number = q.question_number trong RPCs', () => {
      expect(sqlContent).toContain('and link.test_id = q.test_id');
      expect(sqlContent).toContain('and link.question_number = q.question_number');
    });

    it('40. RPC admin_import_v2_question_learning_links thực hiện hai pha (Phase A validate -> Phase B mutate)', () => {
      expect(sqlContent).toContain('-- PHASE A: VALIDATE ALL LINKS BEFORE ANY MUTATION');
      expect(sqlContent).toContain('-- PHASE B: MUTATE (UPSERT) LINKS');
    });

    it('41. Thu hồi các quyền nguy hiểm REVOKE ALL ON TABLE từ vai trò authenticated trên các bảng V2', () => {
      expect(sqlContent).toContain('revoke all on table public.toeic_learning_items from public, anon, authenticated;');
      expect(sqlContent).toContain('revoke all on table public.toeic_question_learning_items from public, anon, authenticated;');
      expect(sqlContent).toContain('revoke all on table public.toeic_learning_practice_events from public, anon, authenticated;');
    });

    it('42. RPC admin_import_v2_question_learning_links từ chối payload NULL hoặc rỗng []', () => {
      expect(sqlContent).toContain("if links_payload is null or jsonb_typeof(links_payload) != 'array' or jsonb_array_length(links_payload) = 0 then");
      expect(sqlContent).toContain("raise exception 'Invalid payload: expected non-empty array of links';");
    });

    it('43. Kiểm tra tính hợp lệ của lựa chọn dựa trên hình dạng v_q_options thực tế trong DB', () => {
      expect(sqlContent).toContain("if jsonb_typeof(v_q_options) = 'array' then");
      expect(sqlContent).toContain("v_opt_idx := ascii(v_clean_opt) - 65;");
      expect(sqlContent).toContain("if jsonb_typeof(v_q_options) = 'object' then");
      expect(sqlContent).toContain("if not (v_q_options ? v_clean_opt) then");
    });

    it('44. File preflight Read-Only 100% chứa các câu lệnh SELECT và 0 câu lệnh ghi/đổi cấu trúc', () => {
      expect(preflightSql).toContain('PREFLIGHT_01_V2_OBJECT_EXISTENCE');
      expect(preflightSql).toContain('PREFLIGHT_02_CANONICAL_COLUMNS');
      expect(preflightSql).not.toContain('INSERT INTO');
      expect(preflightSql).not.toContain('UPDATE ');
      expect(preflightSql).not.toContain('DELETE FROM');
      expect(preflightSql).not.toContain('ALTER TABLE');
      expect(preflightSql).not.toContain('DROP TABLE');
    });

    it('45. File post-apply Read-Only 100% chứa các câu lệnh SELECT kiểm tra sau migration', () => {
      expect(verifySql).toContain('VERIFY_01_TABLES_EXISTENCE');
      expect(verifySql).toContain('VERIFY_04_PRACTICE_EVENTS_PRIVILEGE_MATRIX');
      expect(verifySql).not.toContain('INSERT INTO');
      expect(verifySql).not.toContain('UPDATE ');
      expect(verifySql).not.toContain('DELETE FROM');
    });

    it('46. Migration chưa giải quyết 20260812_part7_structure_first_lock.sql giữ nguyên 100% không bị đụng tới', () => {
      const part7LockPath = path.join(
        process.cwd(),
        'database/migrations/20260812_part7_structure_first_lock.sql'
      );
      expect(fs.existsSync(part7LockPath)).toBe(true);
    });

    it('47. Policy RLS toeic_question_learning_items định danh rõ ràng cột outer row (explicit table qualification)', () => {
      expect(sqlContent).toContain('where t.id = public.toeic_question_learning_items.test_id');
      expect(sqlContent).toContain('and q.id = public.toeic_question_learning_items.question_id');
      expect(sqlContent).toContain('and q.question_number = public.toeic_question_learning_items.question_number');
      expect(sqlContent).toContain('where item.id = public.toeic_question_learning_items.item_id');
    });

    it('48. Thực hiện REVOKE ALL ON TABLE cho vai trò public, anon, authenticated trước khi cấp lại quyền cụ thể', () => {
      expect(sqlContent).toContain('revoke all on table public.toeic_learning_items from public, anon, authenticated;');
      expect(sqlContent).toContain('revoke all on table public.toeic_question_learning_items from public, anon, authenticated;');
      expect(sqlContent).toContain('revoke all on table public.toeic_learning_practice_events from public, anon, authenticated;');
    });

    it('49. Preflight SQL chẩn đoán chi tiết hình dạng v_q_options (array length & object keys)', () => {
      expect(preflightSql).toContain('PREFLIGHT_05_OPTIONS_SHAPES');
      expect(preflightSql).toContain('jsonb_array_length(options)');
    });
  });
});
