import { describe, it, expect } from 'vitest';
import { compareStructureWithDatabase, DbGroupInfo, DbQuestionInfo } from './part7StructureComparison';
import { Part7StructureManifest } from './part7StructureManifest';
import { computePassageFingerprint } from './part7StructureParser';

describe('Part 7 DB Structure Comparison & Repair Plan Suite', () => {
  const fp1 = computePassageFingerprint('Passage 1');
  const fp2 = computePassageFingerprint('Passage 2');

  const mockManifest: Part7StructureManifest = {
    version: 1,
    part: 'part7',
    startQuestion: 147,
    endQuestion: 200,
    questionCount: 54,
    groupCount: 2,
    groups: [
      { order: 1, startQuestion: 147, endQuestion: 148, questionNumbers: [147, 148], sourceHeader: 'Q147-148', passageFingerprint: fp1 },
      { order: 2, startQuestion: 149, endQuestion: 151, questionNumbers: [149, 150, 151], sourceHeader: 'Q149-151', passageFingerprint: fp2 },
    ],
    structureHash: '147-148|149-151',
  };

  const mockDbGroups: DbGroupInfo[] = [
    { id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage 1', question_numbers: [147, 148, 149], min_qn: 147, max_qn: 149 },
    { id: 'g-2', part: 'part7', sort_order: 2, passage: 'Passage 2', question_numbers: [150, 151], min_qn: 150, max_qn: 151 },
  ];

  const mockDbQuestions: DbQuestionInfo[] = [
    { id: 'q-147', question_number: 147, group_id: 'g-1' },
    { id: 'q-148', question_number: 148, group_id: 'g-1' },
    { id: 'q-149', question_number: 149, group_id: 'g-1' }, // Legacy DB bug: Q149 is in Group 1!
    { id: 'q-150', question_number: 150, group_id: 'g-2' },
    { id: 'q-151', question_number: 151, group_id: 'g-2' },
  ];

  it('27. detects exact structure match when DB matches source', () => {
    const matchingDbGroups: DbGroupInfo[] = [
      { id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage 1', question_numbers: [147, 148], min_qn: 147, max_qn: 148 },
      { id: 'g-2', part: 'part7', sort_order: 2, passage: 'Passage 2', question_numbers: [149, 150, 151], min_qn: 149, max_qn: 151 },
    ];
    const matchingQuestions: DbQuestionInfo[] = [
      { id: 'q-147', question_number: 147, group_id: 'g-1' },
      { id: 'q-148', question_number: 148, group_id: 'g-1' },
      { id: 'q-149', question_number: 149, group_id: 'g-2' },
      { id: 'q-150', question_number: 150, group_id: 'g-2' },
      { id: 'q-151', question_number: 151, group_id: 'g-2' },
    ];

    const plan = compareStructureWithDatabase(mockManifest, matchingDbGroups, matchingQuestions, false);

    expect(plan.totalMovedQuestions).toBe(0);
    expect(plan.groupComparisons[0].status).toBe('MATCH');
    expect(plan.groupComparisons[1].status).toBe('MATCH');
  });

  it('28. detects membership mismatch when Q149 is in Group 1 instead of Group 2', () => {
    const plan = compareStructureWithDatabase(mockManifest, mockDbGroups, mockDbQuestions, false);

    expect(plan.totalMovedQuestions).toBe(1);
    expect(plan.groupComparisons[1].movedQuestions[0].questionNumber).toBe(149);
    expect(plan.groupComparisons[1].movedQuestions[0].fromGroupId).toBe('g-1');
    expect(plan.groupComparisons[1].movedQuestions[0].toGroupId).toBe('g-2');
  });

  it('29. resolves DB group membership strictly by question.group_id, not metadata range', () => {
    const plan = compareStructureWithDatabase(mockManifest, mockDbGroups, mockDbQuestions, false);
    const q149Mapping = plan.questionMappings.find((m) => m.question_number === 149);

    expect(q149Mapping?.target_group_id).toBe('g-2');
  });

  it('30. sorts DB groups stably by minimum question_number', () => {
    const unsortedDbGroups = [...mockDbGroups].reverse();
    const plan = compareStructureWithDatabase(mockManifest, unsortedDbGroups, mockDbQuestions, false);

    expect(plan.groupComparisons[0].sourceRange).toBe('Q147–148');
    expect(plan.groupComparisons[0].targetGroupId).toBe('g-1');
  });

  it('31. detects passage fingerprint match', () => {
    const plan = compareStructureWithDatabase(mockManifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.groupComparisons[0].passageStatus).toBe('PASSAGE_MATCH');
  });

  it('32. only changed question memberships are included in movedQuestions', () => {
    const plan = compareStructureWithDatabase(mockManifest, mockDbGroups, mockDbQuestions, false);

    expect(plan.totalMovedQuestions).toBe(1);
    expect(plan.groupComparisons[0].movedQuestions.length).toBe(0); // Q147 & Q148 stay in g-1
    expect(plan.groupComparisons[1].movedQuestions.length).toBe(1); // Q149 moves from g-1 to g-2
  });

  it('33. unchanged questions remain mapped to their target group without error', () => {
    const plan = compareStructureWithDatabase(mockManifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.questionMappings.length).toBe(5);
  });

  it('34. same group count allows repair plan generation', () => {
    const plan = compareStructureWithDatabase(mockManifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.isApplyAllowed).toBe(true);
    expect(plan.groupCountMatch).toBe(true);
  });

  it('35. differing group count blocks automatic repair plan application', () => {
    const dbWith3Groups: DbGroupInfo[] = [
      ...mockDbGroups,
      { id: 'g-3', part: 'part7', sort_order: 3, passage: 'Extra', question_numbers: [152], min_qn: 152, max_qn: 152 },
    ];
    const plan = compareStructureWithDatabase(mockManifest, dbWith3Groups, mockDbQuestions, false);

    expect(plan.isApplyAllowed).toBe(false);
    expect(plan.groupCountMatch).toBe(false);
    expect(plan.blockReason).toContain('Số group DB (3) khác số bài đọc nguồn (2)');
  });

  it('36. protected bilingual units metadata blocks automated structure repair', () => {
    const protectedGroups: DbGroupInfo[] = [
      { ...mockDbGroups[0], has_bilingual_units: true },
      mockDbGroups[1],
    ];
    const plan = compareStructureWithDatabase(mockManifest, protectedGroups, mockDbQuestions, false);

    expect(plan.isApplyAllowed).toBe(false);
    expect(plan.blockReason).toContain('đã có bilingual units / evidence metadata');
  });

  it('37. protected evidence metadata blocks automated structure repair', () => {
    const protectedGroups: DbGroupInfo[] = [
      mockDbGroups[0],
      { ...mockDbGroups[1], has_evidence: true },
    ];
    const plan = compareStructureWithDatabase(mockManifest, protectedGroups, mockDbQuestions, false);

    expect(plan.isApplyAllowed).toBe(false);
    expect(plan.blockReason).toContain('đã có bilingual units / evidence metadata');
  });

  it('38. published test allows scanning but disables structure apply', () => {
    const plan = compareStructureWithDatabase(mockManifest, mockDbGroups, mockDbQuestions, true);

    expect(plan.isApplyAllowed).toBe(false);
    expect(plan.blockReason).toContain('PUBLISHED');
  });

  it('39. expectedCurrentStructureHash is correctly captured for stale-plan verification', () => {
    const plan = compareStructureWithDatabase(mockManifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.expectedCurrentStructureHash).toBe('147,148,149|150,151');
  });

  it('40. detectedStructureHash is correctly captured from manifest', () => {
    const plan = compareStructureWithDatabase(mockManifest, mockDbGroups, mockDbQuestions, false);
    expect(plan.detectedStructureHash).toBe('147,148|149,150,151');
  });
});
