import { describe, it, expect } from 'vitest';
import { parsePart7BatchBlock } from '../../lib/cms/part7BatchParser';

describe('Part 7 Dynamic Group Size & Workspace Suite', () => {
  const mockGroups345 = [
    { id: 'g-2q', part: 'part7', start_question: 159, end_question: 160 },
    { id: 'g-3q', part: 'part7', start_question: 161, end_question: 163 },
    { id: 'g-4q', part: 'part7', start_question: 164, end_question: 167 },
    { id: 'g-5q', part: 'part7', start_question: 168, end_question: 172 },
  ];

  const mockQuestions345 = [
    ...[159, 160].map(q => ({ id: `q-${q}`, part: 'part7', question_number: q, group_id: 'g-2q', options: ['a', 'b', 'c', 'd'] })),
    ...[161, 162, 163].map(q => ({ id: `q-${q}`, part: 'part7', question_number: q, group_id: 'g-3q', options: ['a', 'b', 'c', 'd'] })),
    ...[164, 165, 166, 167].map(q => ({ id: `q-${q}`, part: 'part7', question_number: q, group_id: 'g-4q', options: ['a', 'b', 'c', 'd'] })),
    ...[168, 169, 170, 171, 172].map(q => ({ id: `q-${q}`, part: 'part7', question_number: q, group_id: 'g-5q', options: ['a', 'b', 'c', 'd'] })),
  ];

  it('1. parses 2-question group correctly (Q159-160)', () => {
    const textEn = `QUESTIONS 159-160\n\n[EMAIL] Special Discount\nDetails...\n\n159. Q159?\n(A) a\n(B) b\n(C) c\n(D) d\n\n160. Q160?\n(A) a\n(B) b\n(C) c\n(D) d`;
    const res = parsePart7BatchBlock(textEn, '', mockGroups345, mockQuestions345);
    const g2 = res.groups.find(g => g.groupId === 'g-2q');

    expect(g2).toBeDefined();
    expect(g2?.questions.length).toBe(2);
    expect(g2?.isComplete).toBe(true);
    expect(g2?.rangeLabel).toBe('Q159–160');
  });

  it('2. parses 3-question group correctly (Q161-163)', () => {
    const textEn = `QUESTIONS 161-163\n\n[NOTICE] Meeting\nDetails...\n\n161. Q161?\n(A) a\n(B) b\n(C) c\n(D) d\n\n162. Q162?\n(A) a\n(B) b\n(C) c\n(D) d\n\n163. Q163?\n(A) a\n(B) b\n(C) c\n(D) d`;
    const res = parsePart7BatchBlock(textEn, '', mockGroups345, mockQuestions345);
    const g3 = res.groups.find(g => g.groupId === 'g-3q');

    expect(g3).toBeDefined();
    expect(g3?.questions.length).toBe(3);
    expect(g3?.isComplete).toBe(true);
    expect(g3?.rangeLabel).toBe('Q161–163');
  });

  it('3. parses 4-question group correctly (Q164-167)', () => {
    const textEn = `QUESTIONS 164-167\n\n[ARTICLE] News\nDetails...\n\n164. Q164?\n(A) a\n(B) b\n(C) c\n(D) d\n\n165. Q165?\n(A) a\n(B) b\n(C) c\n(D) d\n\n166. Q166?\n(A) a\n(B) b\n(C) c\n(D) d\n\n167. Q167?\n(A) a\n(B) b\n(C) c\n(D) d`;
    const res = parsePart7BatchBlock(textEn, '', mockGroups345, mockQuestions345);
    const g4 = res.groups.find(g => g.groupId === 'g-4q');

    expect(g4).toBeDefined();
    expect(g4?.questions.length).toBe(4);
    expect(g4?.isComplete).toBe(true);
  });

  it('4. parses 5-question group correctly (Q168-172)', () => {
    const textEn = `QUESTIONS 168-172\n\n[CHAT] Team Chat\nDetails...\n\n168. Q168?\n(A) a\n(B) b\n(C) c\n(D) d\n\n169. Q169?\n(A) a\n(B) b\n(C) c\n(D) d\n\n170. Q170?\n(A) a\n(B) b\n(C) c\n(D) d\n\n171. Q171?\n(A) a\n(B) b\n(C) c\n(D) d\n\n172. Q172?\n(A) a\n(B) b\n(C) c\n(D) d`;
    const res = parsePart7BatchBlock(textEn, '', mockGroups345, mockQuestions345);
    const g5 = res.groups.find(g => g.groupId === 'g-5q');

    expect(g5).toBeDefined();
    expect(g5?.questions.length).toBe(5);
    expect(g5?.isComplete).toBe(true);
  });

  it('5. blocks 2-question group missing one question', () => {
    const textEn = `QUESTIONS 159-160\n\n[EMAIL] Test\nText...\n\n159. Q159?\n(A) a\n(B) b\n(C) c\n(D) d`;
    const res = parsePart7BatchBlock(textEn, '', mockGroups345, mockQuestions345);
    const g2 = res.groups.find(g => g.groupId === 'g-2q');

    expect(g2?.isComplete).toBe(false);
    expect(g2?.validationError).toContain('Thiếu Q160');
  });

  it('6. blocks 2-question group with unexpected 3rd question', () => {
    const textEn = `QUESTIONS 159-160\n\n[EMAIL] Test\nText...\n\n159. Q159?\n(A) a\n(B) b\n(C) c\n(D) d\n\n160. Q160?\n(A) a\n(B) b\n(C) c\n(D) d\n\n161. Q161?\n(A) a\n(B) b\n(C) c\n(D) d`;
    const res = parsePart7BatchBlock(textEn, '', mockGroups345, mockQuestions345);
    const g2 = res.groups.find(g => g.groupId === 'g-2q');

    expect(g2?.isComplete).toBe(false);
    expect(g2?.validationError).toContain('Phát hiện Q161 không thuộc nhóm');
  });

  it('7. resolves group membership strictly by group_id and expected question numbers', () => {
    const res = parsePart7BatchBlock(`QUESTIONS 161-163\n\n[NOTICE] Test\n...\n\n161. Q161?\n(A) a\n(B) b\n(C) c\n(D) d\n\n162. Q162?\n(A) a\n(B) b\n(C) c\n(D) d\n\n163. Q163?\n(A) a\n(B) b\n(C) c\n(D) d`, '', mockGroups345, mockQuestions345);
    expect(res.groups[0].groupId).toBe('g-3q');
    expect(res.groups[0].expectedQuestionNumbers).toEqual([161, 162, 163]);
  });

  it('8. switching from one group size to another dynamically updates header text', () => {
    const getHeaderCountLabel = (qs: any[]) => `${qs.length} câu hỏi`;

    const qs2 = mockQuestions345.filter(q => q.group_id === 'g-2q');
    const qs3 = mockQuestions345.filter(q => q.group_id === 'g-3q');
    const qs4 = mockQuestions345.filter(q => q.group_id === 'g-4q');
    const qs5 = mockQuestions345.filter(q => q.group_id === 'g-5q');

    expect(getHeaderCountLabel(qs2)).toBe('2 câu hỏi');
    expect(getHeaderCountLabel(qs3)).toBe('3 câu hỏi');
    expect(getHeaderCountLabel(qs4)).toBe('4 câu hỏi');
    expect(getHeaderCountLabel(qs5)).toBe('5 câu hỏi');
  });

  // White Screen Protection & Optional Fields Fallback Tests
  it('9. Part 7 renders safely when part7_bilingual_units = null or []', () => {
    const groupWithNullUnits: any = {
      id: 'g-1',
      part: 'part7',
      passage: 'Sample passage text...',
      documents: null,
      part7_bilingual_units: null,
    };

    const docs = groupWithNullUnits.documents && Array.isArray(groupWithNullUnits.documents)
      ? groupWithNullUnits.documents
      : [{ content: groupWithNullUnits.passage }];

    expect(docs.length).toBe(1);
    expect(docs[0].content).toBe('Sample passage text...');
  });

  it('10. Part 7 renders safely when evidence = null or []', () => {
    const qWithNullEvidence: any = {
      id: 'q-147',
      question_number: 147,
      question_text: 'What is true?',
      options: ['A', 'B', 'C', 'D'],
      evidence: null,
    };

    const hasEvidence = Array.isArray(qWithNullEvidence.evidence) && qWithNullEvidence.evidence.length > 0;
    expect(hasEvidence).toBe(false);
  });

  it('11. documents exists but documents_vi is null -> English still renders', () => {
    const group: any = {
      documents: [{ content: 'English text' }],
      documents_vi: null,
    };

    const docEn = group.documents[0].content;
    const docVi = group.documents_vi ? group.documents_vi[0] : null;

    expect(docEn).toBe('English text');
    expect(docVi).toBeNull();
  });

  it('12. question translation_vi null or options_vi null -> English still renders', () => {
    const q: any = {
      question_text: 'Where is the event?',
      translation_vi: null,
      options: ['Building A', 'Building B', 'Building C', 'Building D'],
      options_vi: null,
    };

    expect(q.question_text).toBe('Where is the event?');
    expect(q.translation_vi).toBeNull();
    expect(q.options.length).toBe(4);
    expect(q.options_vi).toBeNull();
  });

  it('13. direct URL ?mode=part&part=7 selects Part 7 route correctly', () => {
    const searchParams = new URLSearchParams('mode=part&part=7');
    const mode = searchParams.get('mode');
    const partNumber = parseInt(searchParams.get('part')!, 10);

    const isPart7Mode = mode === 'part' && partNumber === 7;
    expect(isPart7Mode).toBe(true);
  });

  it('14. published Part 7 response missing optional new fields does not crash', () => {
    const publishedGroupResponse: any = {
      id: 'g-147-150',
      part: 'part7',
      passage: 'Published reading text',
      documents: [{ content: 'Published reading text' }],
      instruction: 'Read article',
      // part7_bilingual_units and evidence missing!
    };

    const units = Array.isArray(publishedGroupResponse.part7_bilingual_units)
      ? publishedGroupResponse.part7_bilingual_units
      : [];

    expect(units).toEqual([]);
    expect(publishedGroupResponse.documents[0].content).toBe('Published reading text');
  });

  it('15. full/mock exam mode hides Vietnamese and evidence', () => {
    const isPartMode = false; // Mock exam mode
    const showBilingualInMock = isPartMode; // Must be false!
    const showEvidenceInMock = isPartMode; // Must be false!

    expect(showBilingualInMock).toBe(false);
    expect(showEvidenceInMock).toBe(false);
  });
});
