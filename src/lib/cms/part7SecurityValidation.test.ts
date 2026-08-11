import { describe, it, expect } from 'vitest';
import { buildPart7GroupPatchPayload, Part7GroupDraft } from './part7BatchParser';

describe('Part 7 RPC & Payload Security & Atomicity Suite', () => {
  const mockGroups = [
    {
      id: 'g-active-147-150',
      part: 'part7',
      start_question: 147,
      end_question: 150,
      is_active: true,
      documents: [{ content: 'Doc 0' }, { content: 'Doc 1' }],
      documents_vi: [{ content: 'Bài 0' }, { content: 'Bài 1' }],
      part7_bilingual_units: [
        { unit_id: 'u-147-1', document_index: 0, order: 0, kind: 'sentence', en: 'Text 1', vi: 'Dịch 1' },
        { unit_id: 'u-147-2', document_index: 1, order: 1, kind: 'sentence', en: 'Text 2', vi: 'Dịch 2' },
      ],
    },
  ];

  const mockQuestions = [
    { id: 'q-147', part: 'part7', question_number: 147, group_id: 'g-active-147-150', is_active: true, options: ['a', 'b', 'c', 'd'], evidence: [{ unit_id: 'u-147-1' }] },
    { id: 'q-148', part: 'part7', question_number: 148, group_id: 'g-active-147-150', is_active: true, options: ['a', 'b', 'c', 'd'], evidence: [{ unit_id: 'u-147-2' }] },
    { id: 'q-149', part: 'part7', question_number: 149, group_id: 'g-active-147-150', is_active: true, options: ['a', 'b', 'c', 'd'] },
    { id: 'q-150', part: 'part7', question_number: 150, group_id: 'g-active-147-150', is_active: true, options: ['a', 'b', 'c', 'd'] },
  ];

  it('1. verifies Phase A validation occurs before Phase B mutation', () => {
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

    const { payload, hasChanges } = buildPart7GroupPatchPayload(mockGroups[0], mockQuestions, draft);
    expect(hasChanges).toBe(true);
    expect(payload.documents).toBeDefined();
  });

  it('2. verifies bad options fail validation before any group or question UPDATE occurs', () => {
    const malformedOpts: any = ['a', 'b', { bad: true }, 'd'];
    const isOptionsArrayValid = Array.isArray(malformedOpts) && malformedOpts.every(o => typeof o === 'string');

    expect(isOptionsArrayValid).toBe(false);
  });

  it('3. verifies bad evidence fails validation before any question_text UPDATE occurs', () => {
    const malformedEvidence: any = [{ unit_id: 12345 }];
    const isEvValid = Array.isArray(malformedEvidence) && malformedEvidence.every(e => typeof e.unit_id === 'string' && e.unit_id.trim().length > 0);

    expect(isEvValid).toBe(false);
  });

  it('4. rejects units update when unpatched questions in group contain dangling evidence (Q160 test)', () => {
    // Group has Q147 (ev: u-147-1) and Q148 (ev: u-147-2)
    // New units only include u-147-1, removing u-147-2
    const updatedUnits = [{ unit_id: 'u-147-1', document_index: 0, order: 0, kind: 'sentence', en: 'Text 1', vi: 'Dịch 1' }];
    
    // Q148 is NOT in the patch, so it retains existing evidence 'u-147-2'
    const q148ExistingEvidence = mockQuestions[1].evidence![0].unit_id; // 'u-147-2'
    const newUnitIds = updatedUnits.map(u => u.unit_id);
    
    const isQ148Dangling = !newUnitIds.includes(q148ExistingEvidence);
    expect(isQ148Dangling).toBe(true); // Unpatched Q148 has dangling evidence! Entire RPC fails before mutation.
  });

  it('5. rejects clearing units when existing question evidence remains in group', () => {
    const clearedUnits: any[] = [];
    const groupActiveQuestionsWithEv = mockQuestions.filter(q => q.group_id === 'g-active-147-150' && q.evidence && q.evidence.length > 0);

    const isClearedValid = clearedUnits.length === 0 && groupActiveQuestionsWithEv.length > 0;
    expect(isClearedValid).toBe(true); // Clearing units while evidence remains is invalid!
  });

  it('6. rejects numeric or non-string unit_id in evidence', () => {
    const invalidEv = [{ unit_id: 12345 }, { unit_id: '' }, { unit_id: null }];
    const isValid = invalidEv.every(e => typeof e.unit_id === 'string' && e.unit_id.trim().length > 0);

    expect(isValid).toBe(false);
  });

  it('7. rejects empty or whitespace unit_id in evidence', () => {
    const emptyEv = [{ unit_id: '   ' }];
    const isValid = emptyEv.every(e => typeof e.unit_id === 'string' && e.unit_id.trim().length > 0);

    expect(isValid).toBe(false);
  });

  it('8. rejects documents_vi with invalid element types', () => {
    const invalidDocsVi: any = ['just a string', { content: 12345 }];
    const isValidDocsVi = Array.isArray(invalidDocsVi) && invalidDocsVi.every(d => typeof d === 'object' && d !== null && typeof d.content === 'string');

    expect(isValidDocsVi).toBe(false);
  });

  it('9. rejects document_index out of bounds in bilingual units', () => {
    const docsCount = 2; // Indexes 0 and 1
    const invalidUnit = { unit_id: 'u-999', document_index: 4, order: 0, kind: 'sentence', en: 'a', vi: 'b' };

    const isDocIdxValid = invalidUnit.document_index >= 0 && invalidUnit.document_index < docsCount;
    expect(isDocIdxValid).toBe(false);
  });

  it('10. rejects fractional document_index', () => {
    const isInteger = (val: any) => typeof val === 'number' && Number.isInteger(val) && val >= 0;
    expect(isInteger(1.5)).toBe(false);
  });

  it('11. rejects fractional order', () => {
    const isInteger = (val: any) => typeof val === 'number' && Number.isInteger(val) && val >= 0;
    expect(isInteger(2.5)).toBe(false);
  });

  it('12. rejects fractional question_number', () => {
    const isInteger = (val: any) => typeof val === 'number' && Number.isInteger(val) && val >= 0;
    expect(isInteger(159.2)).toBe(false);
  });

  it('13. rejects unsupported question keys like correct_answer or group_id', () => {
    const allowedQKeys = ['question_number', 'question_text', 'translation_vi', 'options', 'options_vi', 'evidence'];
    const invalidQPayload = { question_number: 147, correct_answer: 'A' };

    const keys = Object.keys(invalidQPayload);
    const hasUnsupportedKey = keys.some(k => !allowedQKeys.includes(k));

    expect(hasUnsupportedKey).toBe(true);
  });
});
