import { describe, it, expect } from 'vitest';
import { parsePart7BatchBlock, buildPart7GroupPatchPayload } from './part7BatchParser';

describe('Part 7 Multi-Group Batch Parser & Patch Builder Suite', () => {
  const mockGroups = [
    { id: 'grp-147-150', part: 'part7', start_question: 147, end_question: 150, documents: [], documents_vi: [] },
    { id: 'grp-151-154', part: 'part7', start_question: 151, end_question: 154, documents: [], documents_vi: [] },
  ];

  const mockQuestions = [
    ...[147, 148, 149, 150].map(q => ({ id: `q-${q}`, part: 'part7', question_number: q, group_id: 'grp-147-150', options: ['', '', '', ''], options_vi: ['', '', '', ''] })),
    ...[151, 152, 153, 154].map(q => ({ id: `q-${q}`, part: 'part7', question_number: q, group_id: 'grp-151-154', options: ['', '', '', ''], options_vi: ['', '', '', ''] })),
  ];

  it('1. parses single-group Part 7 batch (Q147-150)', () => {
    const textEn = `QUESTIONS 147-150\n\n[EMAIL] Notice of Maintenance\nPlease be advised that the system will undergo maintenance on Saturday.\n\n147. What is the purpose of the email?\n(A) To announce maintenance\n(B) To cancel a booking\n(C) To hire a technician\n(D) To request feedback\n\n148. When will maintenance occur?\n(A) Monday\n(B) Saturday\n(C) Sunday\n(D) Friday\n\n149. Who should be contacted?\n(A) Support\n(B) Manager\n(C) Director\n(D) Vendor\n\n150. What action is required?\n(A) Save work\n(B) Leave early\n(C) Call IT\n(D) Log off`;
    const textVi = `CÂU 147-150\n\n[EMAIL] Thông báo bảo trì\nXin lưu ý hệ thống sẽ bảo trì vào thứ Bảy.\n\n147. Mục đích của email là gì?\n(A) Thông báo bảo trì\n(B) Hủy đặt chỗ\n(C) Thuê kỹ thuật viên\n(D) Yêu cầu phản hồi\n\n148. Khi nào bảo trì?\n(A) Thứ Hai\n(B) Thứ Bảy\n(C) Thứ Bảy\n(D) Thứ Sáu\n\n149. Ai nên liên hệ?\n(A) Hỗ trợ\n(B) Quản lý\n(C) Giám đốc\n(D) Nhà cung cấp\n\n150. Cần làm gì?\n(A) Lưu công việc\n(B) Về sớm\n(C) Gọi IT\n(D) Đăng xuất`;

    const res = parsePart7BatchBlock(textEn, textVi, mockGroups, mockQuestions);
    expect(res.groups.length).toBe(1);

    const g1 = res.groups[0];
    expect(g1.rangeLabel).toBe('Q147–150');
    expect(g1.isComplete).toBe(true);
    expect(g1.documents.length).toBe(1);
    expect(g1.questions.length).toBe(4);
    expect(g1.questions[0].question_text).toBe('What is the purpose of the email?');
    expect(g1.questions[0].translation_vi).toBe('Mục đích của email là gì?');
    expect(g1.questions[0].options[0]).toBe('To announce maintenance');
  });

  it('2. parses multi-group batch (Q147-150 and Q151-154)', () => {
    const textEn = `QUESTIONS 147-150\n\n[NOTICE] Office Closure\nOffice closed.\n\n147. Q147?\n(A) a\n(B) b\n(C) c\n(D) d\n\n148. Q148?\n(A) a\n(B) b\n(C) c\n(D) d\n\n149. Q149?\n(A) a\n(B) b\n(C) c\n(D) d\n\n150. Q150?\n(A) a\n(B) b\n(C) c\n(D) d\n\nQUESTIONS 151-154\n\n[ARTICLE] Market Trends\nMarket info.\n\n151. Q151?\n(A) a\n(B) b\n(C) c\n(D) d\n\n152. Q152?\n(A) a\n(B) b\n(C) c\n(D) d\n\n153. Q153?\n(A) a\n(B) b\n(C) c\n(D) d\n\n154. Q154?\n(A) a\n(B) b\n(C) c\n(D) d`;

    const res = parsePart7BatchBlock(textEn, '', mockGroups, mockQuestions);
    expect(res.groups.length).toBe(2);
    expect(res.groups[0].rangeLabel).toBe('Q147–150');
    expect(res.groups[1].rangeLabel).toBe('Q151–154');
    expect(res.groups[0].isComplete).toBe(true);
    expect(res.groups[1].isComplete).toBe(true);
  });

  it('3. flags incomplete group if batch ends halfway', () => {
    const incompleteText = `QUESTIONS 147-150\n\n[EMAIL] Test\nText...\n\n147. Q147?\n(A) a\n(B) b\n(C) c\n(D) d\n\n148. Q148?\n(A) a\n(B) b\n(C) c\n(D) d`;

    const res = parsePart7BatchBlock(incompleteText, '', mockGroups, mockQuestions);
    expect(res.groups.length).toBe(1);
    expect(res.groups[0].isComplete).toBe(false);
    expect(res.groups[0].validationError).toContain('Thiếu Q149, Q150');
  });

  it('4. builds atomic patch payload for Part 7 group update', () => {
    const dbGroup = mockGroups[0];
    const dbQs = mockQuestions.slice(0, 4);

    const draft = {
      groupId: dbGroup.id,
      expectedQuestionNumbers: [147, 148, 149, 150],
      rangeLabel: 'Q147–150',
      groupType: 'single_passage' as const,
      documents: [{ type: 'email', title: 'Re: Meeting', content: 'Details here' }],
      documents_vi: [{ type: 'email', title: 'Trả lời: Cuộc họp', content: 'Chi tiết tại đây' }],
      questions: dbQs.map(q => ({
        question_number: q.question_number,
        question_text: `Stem for Q${q.question_number}`,
        translation_vi: `Bản dịch Q${q.question_number}`,
        options: ['A', 'B', 'C', 'D'] as [string, string, string, string],
        options_vi: ['Avi', 'Bvi', 'Cvi', 'Dvi'] as [string, string, string, string],
      })),
      units: [],
      isComplete: true,
    };

    const { payload, hasChanges } = buildPart7GroupPatchPayload(dbGroup, dbQs, draft);
    expect(hasChanges).toBe(true);
    expect(payload.documents).toBeDefined();
    expect(payload.documents_vi).toBeDefined();
    expect(payload.questions.length).toBe(4);
    expect(payload.questions[0].question_text).toBe('Stem for Q147');
    expect(payload.questions[0]).not.toHaveProperty('correct_answer');
  });
});
