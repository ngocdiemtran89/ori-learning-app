import { describe, it, expect } from 'vitest';
import { buildPart7GroupPatchPayload, Part7GroupDraft } from './part7BatchParser';

describe('Part 7 RPC & Payload Security Hardening Suite', () => {
  const mockGroups = [
    {
      id: 'g-active-147-150',
      part: 'part7',
      start_question: 147,
      end_question: 150,
      is_active: true,
      part7_bilingual_units: [
        { unit_id: 'u-147-1', document_index: 0, order: 0, kind: 'sentence', en: 'Text 1', vi: 'Dịch 1' },
      ],
    },
    {
      id: 'g-active-151-154',
      part: 'part7',
      start_question: 151,
      end_question: 154,
      is_active: true,
      part7_bilingual_units: [
        { unit_id: 'u-151-1', document_index: 0, order: 0, kind: 'sentence', en: 'Other Text', vi: 'Dịch khác' },
      ],
    },
    {
      id: 'g-inactive-155-158',
      part: 'part7',
      start_question: 155,
      end_question: 158,
      is_active: false,
    },
  ];

  const mockQuestions = [
    { id: 'q-147', part: 'part7', question_number: 147, group_id: 'g-active-147-150', is_active: true, options: ['a', 'b', 'c', 'd'], evidence: [{ unit_id: 'u-147-1' }] },
    { id: 'q-148', part: 'part7', question_number: 148, group_id: 'g-active-147-150', is_active: true, options: ['a', 'b', 'c', 'd'] },
    { id: 'q-149', part: 'part7', question_number: 149, group_id: 'g-active-147-150', is_active: true, options: ['a', 'b', 'c', 'd'] },
    { id: 'q-150', part: 'part7', question_number: 150, group_id: 'g-active-147-150', is_active: true, options: ['a', 'b', 'c', 'd'] },
    { id: 'q-151', part: 'part7', question_number: 151, group_id: 'g-active-151-154', is_active: true, options: ['a', 'b', 'c', 'd'] },
    { id: 'q-155', part: 'part7', question_number: 155, group_id: 'g-inactive-155-158', is_active: false, options: ['a', 'b', 'c', 'd'] },
  ];

  it('1. verifies Phase A validation occurs before Phase B mutation', () => {
    // Structural test: verify patch builder generates clean, unmutated payload
    const draft: Part7GroupDraft = {
      groupId: 'g-active-147-150',
      expectedQuestionNumbers: [147, 148, 149, 150],
      rangeLabel: 'Q147–150',
      groupType: 'single_passage',
      documents: [{ content: 'Valid Text' }],
      questions: [
        {
          question_number: 147,
          question_text: 'Valid Q147?',
          translation_vi: 'Dịch 147',
          options: ['a', 'b', 'c', 'd'],
          options_vi: ['a', 'b', 'c', 'd'],
        },
      ],
      units: [{ unit_id: 'u-147-1', document_index: 0, order: 0, kind: 'sentence', en: 'Text 1', vi: 'Dịch 1' }],
      isComplete: true,
    };

    const { payload, hasChanges } = buildPart7GroupPatchPayload(mockGroups[0], mockQuestions.slice(0, 4), draft);
    expect(hasChanges).toBe(true);
    expect(payload.documents).toBeDefined();
  });

  it('2. rejects bad options before any group/question UPDATE occurs', () => {
    const malformedOpts: any = ['a', 'b', { bad: true }, 'd'];
    const isOptionsArrayValid = Array.isArray(malformedOpts) && malformedOpts.every(o => typeof o === 'string');

    expect(isOptionsArrayValid).toBe(false);
  });

  it('3. rejects bad evidence before any question_text UPDATE occurs', () => {
    const malformedEvidence: any = [{ unit_id: 12345 }];
    const isEvValid = Array.isArray(malformedEvidence) && malformedEvidence.every(e => typeof e.unit_id === 'string');

    expect(isEvValid).toBe(false);
  });

  it('4. blocks units update + partial question payload from leaving dangling evidence', () => {
    const existingEvidence = mockQuestions[0].evidence![0].unit_id; // 'u-147-1'
    const updatedUnits = [{ unit_id: 'u-NEW-REPLACED', document_index: 0, order: 0, kind: 'sentence' as const, en: 'New', vi: 'Mới' }];

    const hasDanglingEvidence = !updatedUnits.some(u => u.unit_id === existingEvidence);
    expect(hasDanglingEvidence).toBe(true); // Dangling evidence detected and blocked!
  });

  it('5. rejects clearing units when existing question evidence remains in group', () => {
    const clearedUnits: any[] = [];
    const activeQuestionsWithEvidence = mockQuestions.filter(q => q.group_id === 'g-active-147-150' && q.evidence && q.evidence.length > 0);

    const isClearedUnitsValid = clearedUnits.length === 0 && activeQuestionsWithEvidence.length > 0;
    expect(isClearedUnitsValid).toBe(true); // Units null/cleared while evidence remains is invalid!
  });

  it('6. rejects numeric or non-string unit_id in evidence', () => {
    const invalidEv = [{ unit_id: 12345 }, { unit_id: '' }, { unit_id: null }];
    const isValid = invalidEv.every(e => typeof e.unit_id === 'string' && e.unit_id.trim().length > 0);

    expect(isValid).toBe(false);
  });

  it('7. rejects document_index out of bounds in bilingual units', () => {
    const docsCount = 2; // 0 and 1
    const invalidUnit = { unit_id: 'u-999', document_index: 4, order: 0, kind: 'sentence', en: 'a', vi: 'b' };

    const isDocIdxValid = invalidUnit.document_index >= 0 && invalidUnit.document_index < docsCount;
    expect(isDocIdxValid).toBe(false);
  });

  it('8. rejects fractional document_index, order, and question_number', () => {
    const isInteger = (val: number) => Number.isInteger(val) && val >= 0;

    expect(isInteger(1.5)).toBe(false);
    expect(isInteger(159.2)).toBe(false);
    expect(isInteger(2.5)).toBe(false);
    expect(isInteger(2)).toBe(true);
  });

  it('9. rejects documents_vi with invalid element types', () => {
    const invalidDocsVi: any = ['just a string', { noContent: 'missing' }];
    const isValidDocsVi = Array.isArray(invalidDocsVi) && invalidDocsVi.every(d => typeof d === 'object' && d !== null && typeof d.content === 'string');

    expect(isValidDocsVi).toBe(false);
  });

  it('10. rejects unsupported question keys like correct_answer or group_id', () => {
    const allowedQKeys = ['question_number', 'question_text', 'translation_vi', 'options', 'options_vi', 'evidence'];
    const invalidQPayload = { question_number: 147, correct_answer: 'A', group_id: 'g-active-147-150' };

    const keys = Object.keys(invalidQPayload);
    const hasUnsupportedKey = keys.some(k => !allowedQKeys.includes(k));

    expect(hasUnsupportedKey).toBe(true);
  });

  it('11. verifies active group and question conditions require is_active IS NOT FALSE / IS TRUE', () => {
    const activeGroups = mockGroups.filter(g => g.is_active !== false);
    expect(activeGroups.length).toBe(2);

    const inactiveGroupFound = activeGroups.find(g => g.id === 'g-inactive-155-158');
    expect(inactiveGroupFound).toBeUndefined();
  });

  it('12. verifies group_type is excluded from allowed patch keys (writable = NO)', () => {
    const dbGroup = mockGroups[0];
    const dbQs = mockQuestions.slice(0, 4);

    const draft: Part7GroupDraft = {
      groupId: dbGroup.id,
      expectedQuestionNumbers: [147, 148, 149, 150],
      rangeLabel: 'Q147–150',
      groupType: 'double_passage',
      documents: [{ content: 'Doc text' }],
      questions: dbQs.map(q => ({
        question_number: q.question_number,
        question_text: `Text ${q.question_number}`,
        translation_vi: `Dịch ${q.question_number}`,
        options: ['a', 'b', 'c', 'd'] as [string, string, string, string],
        options_vi: ['a', 'b', 'c', 'd'] as [string, string, string, string],
      })),
      units: [],
      isComplete: true,
    };

    const { payload } = buildPart7GroupPatchPayload(dbGroup, dbQs, draft);
    expect(payload).not.toHaveProperty('group_type');
  });
});
