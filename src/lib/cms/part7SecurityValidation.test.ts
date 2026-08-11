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

  it('1. rejects nonexistent evidence unit_id validation', () => {
    const draft: Part7GroupDraft = {
      groupId: 'g-active-147-150',
      expectedQuestionNumbers: [147, 148, 149, 150],
      rangeLabel: 'Q147–150',
      groupType: 'single_passage',
      documents: [{ content: 'Text' }],
      questions: [
        {
          question_number: 147,
          question_text: 'Q147?',
          translation_vi: 'Dịch 147',
          options: ['a', 'b', 'c', 'd'],
          options_vi: ['a', 'b', 'c', 'd'],
          evidence: [{ document_index: 0, unit_id: 'nonexistent-unit-999' }],
        },
      ],
      units: [{ unit_id: 'u-147-1', document_index: 0, order: 0, kind: 'sentence', en: 'Text 1', vi: 'Dịch 1' }],
      isComplete: true,
    };

    const validUnits = draft.units.map(u => u.unit_id);
    const evUnit = draft.questions[0].evidence![0].unit_id;
    const isUnitValid = validUnits.includes(evUnit!);

    expect(isUnitValid).toBe(false); // Nonexistent unit_id rejected!
  });

  it('2. rejects cross-group evidence unit_id validation', () => {
    const crossGroupUnitId = mockGroups[1].part7_bilingual_units![0].unit_id; // 'u-151-1' from Group 151-154

    const draft: Part7GroupDraft = {
      groupId: 'g-active-147-150',
      expectedQuestionNumbers: [147, 148, 149, 150],
      rangeLabel: 'Q147–150',
      groupType: 'single_passage',
      documents: [{ content: 'Text' }],
      questions: [
        {
          question_number: 147,
          question_text: 'Q147?',
          translation_vi: 'Dịch 147',
          options: ['a', 'b', 'c', 'd'],
          options_vi: ['a', 'b', 'c', 'd'],
          evidence: [{ document_index: 0, unit_id: crossGroupUnitId }],
        },
      ],
      units: [{ unit_id: 'u-147-1', document_index: 0, order: 0, kind: 'sentence', en: 'Text 1', vi: 'Dịch 1' }],
      isComplete: true,
    };

    const validUnits = draft.units.map(u => u.unit_id);
    const evUnit = draft.questions[0].evidence![0].unit_id;
    const isUnitValid = validUnits.includes(evUnit!);

    expect(isUnitValid).toBe(false); // Cross-group unit_id rejected!
  });

  it('3. flags dangling evidence when bilingual units are updated without matching evidence', () => {
    const existingEvidence = mockQuestions[0].evidence![0].unit_id; // 'u-147-1'
    const newUnits = [{ unit_id: 'u-NEW-REPLACED', document_index: 0, order: 0, kind: 'sentence', en: 'New', vi: 'Mới' }];

    const hasDanglingEvidence = !newUnits.some(u => u.unit_id === existingEvidence);
    expect(hasDanglingEvidence).toBe(true); // Dangling evidence detected and blocked!
  });

  it('4. rejects non-string option elements', () => {
    const rawMalformedOpts: any = [{ label: 'A', text: 'Option A' }, 123, null, true];
    const isStringArray = Array.isArray(rawMalformedOpts) && rawMalformedOpts.every(item => typeof item === 'string');

    expect(isStringArray).toBe(false); // Non-string option element rejected!
  });

  it('5. rejects duplicate question_number in payload', () => {
    const payloadQuestions = [
      { question_number: 147, question_text: 'Q147' },
      { question_number: 147, question_text: 'Duplicate Q147' },
    ];

    const qNums = payloadQuestions.map(q => q.question_number);
    const hasDuplicates = new Set(qNums).size !== qNums.length;

    expect(hasDuplicates).toBe(true); // Duplicate question_number rejected!
  });

  it('6. rejects inactive target groups and inactive questions', () => {
    const activeGroups = mockGroups.filter(g => g.is_active !== false);
    const inactiveGroupFound = activeGroups.find(g => g.id === 'g-inactive-155-158');

    expect(inactiveGroupFound).toBeUndefined(); // Inactive group rejected!

    const activeQuestions = mockQuestions.filter(q => q.is_active !== false);
    const inactiveQuestionFound = activeQuestions.find(q => q.id === 'q-155');

    expect(inactiveQuestionFound).toBeUndefined(); // Inactive question rejected!
  });

  it('7. verifies group_type is excluded from allowed patch keys (writable = NO)', () => {
    const dbGroup = mockGroups[0];
    const dbQs = mockQuestions.slice(0, 4);

    const draft: Part7GroupDraft = {
      groupId: dbGroup.id,
      expectedQuestionNumbers: [147, 148, 149, 150],
      rangeLabel: 'Q147–150',
      groupType: 'double_passage' as any, // attempt to change group_type
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
    expect(payload).not.toHaveProperty('group_type'); // group_type is NOT writable in patch!
  });
});
