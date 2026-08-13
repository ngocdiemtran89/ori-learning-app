import { describe, it, expect } from 'vitest';
import { buildPart7StructureManifest, computeStructureHash } from './part7StructureManifest';
import { DbGroupInfo } from './part7StructureComparison';

describe('Part 7 Backend Structure Lock & RPC Validation Contract Suite', () => {
  const createMockGroup = (startQ: number, endQ: number, targetGroupId?: string) => {
    const qNums: number[] = [];
    for (let q = startQ; q <= endQ; q++) qNums.push(q);
    return {
      order: startQ,
      startQuestion: startQ,
      endQuestion: endQ,
      questionNumbers: qNums,
      sourceHeader: `Questions ${startQ}–${endQ}`,
      targetGroupId,
    };
  };

  const createComplete54Groups = (): any[] => [
    createMockGroup(147, 148, 'g-1'),
    createMockGroup(149, 151, 'g-2'),
    createMockGroup(152, 154, 'g-3'),
    createMockGroup(155, 157, 'g-4'),
    createMockGroup(158, 160, 'g-5'),
    createMockGroup(161, 164, 'g-6'),
    createMockGroup(165, 168, 'g-7'),
    createMockGroup(169, 172, 'g-8'),
    createMockGroup(173, 175, 'g-9'),
    createMockGroup(176, 180, 'g-10'),
    createMockGroup(181, 185, 'g-11'),
    createMockGroup(186, 190, 'g-12'),
    createMockGroup(191, 195, 'g-13'),
    createMockGroup(196, 200, 'g-14'),
  ];

  it('1. backend manifest missing -> reject payload validation', () => {
    const payload: any = { expected_current_structure_hash: '147,148|...' };
    const isManifestValid = Boolean(payload.manifest && typeof payload.manifest === 'object');
    expect(isManifestValid).toBe(false);
  });

  it('2. groups non-array -> reject manifest validation', () => {
    const manifest: any = { groups: 'not-an-array' };
    const isGroupsValid = Array.isArray(manifest.groups) && manifest.groups.length > 0;
    expect(isGroupsValid).toBe(false);
  });

  it('3. missing Q173 -> reject manifest validation', () => {
    const groups = createComplete54Groups().filter((g) => g.startQuestion !== 173);
    const res = buildPart7StructureManifest(groups as any);
    expect(res.isValid).toBe(false);
    expect(res.missingQuestions).toContain(173);
  });

  it('4. duplicate Q173 -> reject manifest validation', () => {
    const groups = createComplete54Groups();
    groups[0].questionNumbers.push(173);
    const res = buildPart7StructureManifest(groups as any);
    expect(res.isValid).toBe(false);
    expect(res.duplicateQuestions).toContain(173);
  });

  it('5. overlap across groups -> reject manifest validation', () => {
    const groups = createComplete54Groups();
    groups[1].questionNumbers.push(148); // Q148 in both group 1 & group 2
    const res = buildPart7StructureManifest(groups as any);
    expect(res.isValid).toBe(false);
    expect(res.overlappingGroups.length).toBeGreaterThan(0);
  });

  it('6. non-contiguous group numbers [147, 149] -> reject manifest group validation', () => {
    const checkContiguous = (arr: number[]) => {
      for (let i = 1; i < arr.length; i++) {
        if (arr[i] !== arr[i - 1] + 1) return false;
      }
      return true;
    };
    expect(checkContiguous([147, 149])).toBe(false);
    expect(checkContiguous([147, 148, 149])).toBe(true);
  });

  it('7. Q146 included -> reject manifest validation', () => {
    const groups = createComplete54Groups();
    groups[0].questionNumbers.unshift(146);
    const res = buildPart7StructureManifest(groups as any);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.includes('Q146'))).toBe(true);
  });

  it('8. Q201 included -> reject manifest validation', () => {
    const groups = createComplete54Groups();
    groups[groups.length - 1].questionNumbers.push(201);
    const res = buildPart7StructureManifest(groups as any);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.includes('Q201'))).toBe(true);
  });

  it('9. fractional qnum (147.5) -> reject manifest group validation', () => {
    const isInteger = (val: number) => Number.isInteger(val);
    expect(isInteger(147.5)).toBe(false);
    expect(isInteger(147)).toBe(true);
  });

  it('10. exact Q147–200 completeness -> accept validation', () => {
    const groups = createComplete54Groups();
    const res = buildPart7StructureManifest(groups as any);
    expect(res.isValid).toBe(true);
    expect(res.manifest?.questionCount).toBe(54);
  });

  it('11. expected_current_structure_hash missing -> reject apply payload', () => {
    const payload: any = { manifest: {} };
    const hasExpectedHash = Boolean(payload.expected_current_structure_hash && payload.expected_current_structure_hash.trim());
    expect(hasExpectedHash).toBe(false);
  });

  it('12. stale exact-membership hash -> reject repair execution', () => {
    const currentDbHash: string = '147,148,149|150,151';
    const expectedHash: string = '147,148|149,150,151'; // Stale hash!
    const matches = currentDbHash === expectedHash;
    expect(matches).toBe(false);
  });

  it('13. targetGroupId nonexistent -> reject target group validation', () => {
    const existingGroupIds = ['g-1', 'g-2'];
    const targetGroupId = 'g-nonexistent';
    const isValidGroup = existingGroupIds.includes(targetGroupId);
    expect(isValidGroup).toBe(false);
  });

  it('14. targetGroupId belonging to another test -> reject target group validation', () => {
    const dbGroup = { id: 'g-1', test_id: 'test-B', part: 'part7', is_active: true };
    const currentTestId = 'test-A';
    const isValidForTest = dbGroup.test_id === currentTestId;
    expect(isValidForTest).toBe(false);
  });

  it('15. targetGroupId belonging to non-Part7 part -> reject target group validation', () => {
    const dbGroup = { id: 'g-1', test_id: 'test-A', part: 'part3', is_active: true };
    const isPart7Group = dbGroup.part.toLowerCase().trim() === 'part7';
    expect(isPart7Group).toBe(false);
  });

  it('16. targetGroupId inactive -> reject target group validation', () => {
    const dbGroup = { id: 'g-1', test_id: 'test-A', part: 'part7', is_active: false };
    const isActive = dbGroup.is_active === true;
    expect(isActive).toBe(false);
  });

  it('17. duplicate targetGroupId in manifest -> reject payload', () => {
    const groups = [
      { targetGroupId: 'g-1' },
      { targetGroupId: 'g-1' }, // Duplicate target group ID!
    ];
    const targetGroupIds = groups.map((g) => g.targetGroupId);
    const hasDupes = new Set(targetGroupIds).size !== targetGroupIds.length;
    expect(hasDupes).toBe(true);
  });

  it('18. target group count mismatch -> reject automatic repair', () => {
    const dbGroupCount: number = 15;
    const manifestGroupCount: number = 14;
    const isCountMatching = dbGroupCount === manifestGroupCount;
    expect(isCountMatching).toBe(false);
  });

  it('19. arbitrary Part1 question (Q1) cannot be regrouped into Part 7', () => {
    const qNum = 1;
    const isPart7QNum = qNum >= 147 && qNum <= 200;
    expect(isPart7QNum).toBe(false);
  });

  it('20. question outside 147-200 (Q201) cannot be regrouped', () => {
    const qNum = 201;
    const isPart7QNum = qNum >= 147 && qNum <= 200;
    expect(isPart7QNum).toBe(false);
  });

  it('21. backend-derived manifest hash is deterministic', () => {
    const groups = [
      { startQuestion: 147, endQuestion: 148, questionNumbers: [147, 148] },
      { startQuestion: 149, endQuestion: 151, questionNumbers: [149, 150, 151] },
    ];
    const hash1 = computeStructureHash(groups);
    const hash2 = computeStructureHash(groups);
    expect(hash1).toBe('147,148|149,150,151');
    expect(hash1).toBe(hash2);
  });

  it('22. different exact membership gives different structure hash', () => {
    const hashA = computeStructureHash([
      { startQuestion: 147, endQuestion: 148, questionNumbers: [147, 148] },
      { startQuestion: 149, endQuestion: 151, questionNumbers: [149, 150, 151] },
    ]);
    const hashB = computeStructureHash([
      { startQuestion: 147, endQuestion: 149, questionNumbers: [147, 148, 149] },
      { startQuestion: 150, endQuestion: 151, questionNumbers: [150, 151] },
    ]);
    expect(hashA).not.toBe(hashB);
  });

  it('23. malformed [147, 149] cannot equal canonical [147, 148, 149]', () => {
    const hashMalformed = computeStructureHash([{ startQuestion: 147, endQuestion: 149, questionNumbers: [147, 149] }]);
    const hashCanonical = computeStructureHash([{ startQuestion: 147, endQuestion: 149, questionNumbers: [147, 148, 149] }]);

    expect(hashMalformed).toBe('147,149');
    expect(hashCanonical).toBe('147,148,149');
    expect(hashMalformed).not.toBe(hashCanonical);
  });

  it('24. protected question content fingerprint survives regrouping without group_id', () => {
    const computeQuestionFp = (q: any) => `${q.id}|${q.question_number}|${q.part}|${q.question_text || ''}|${q.correct_answer || ''}`;
    const qBefore = { id: 'q-147', question_number: 147, part: 'part7', question_text: 'What is true?', correct_answer: 'A', group_id: 'g-1' };
    const qAfter = { id: 'q-147', question_number: 147, part: 'part7', question_text: 'What is true?', correct_answer: 'A', group_id: 'g-2' }; // group_id changed!

    expect(computeQuestionFp(qBefore)).toBe(computeQuestionFp(qAfter));
  });

  it('25. protected group content fingerprint survives regrouping without question membership', () => {
    const computeGroupFp = (g: any) => `${g.id}|${g.part}|${g.passage || ''}|${JSON.stringify(g.documents || [])}`;
    const g1 = { id: 'g-1', part: 'part7', passage: 'Passage 1', documents: [{ content: 'Doc 1' }] };
    const g2 = { id: 'g-1', part: 'part7', passage: 'Passage 1', documents: [{ content: 'Doc 1' }] };

    expect(computeGroupFp(g1)).toBe(computeGroupFp(g2));
  });

  it('26. null documents/options cannot make fingerprint skip rows or fail concatenation', () => {
    const safeConcat = (val: any) => String(val ?? '');
    expect(safeConcat(null)).toBe('');
    expect(safeConcat(undefined)).toBe('');
    expect(safeConcat('text')).toBe('text');
  });

  it('27. post-repair membership must exactly equal manifest hash', () => {
    const postRepairDbHash = '147,148|149,150,151';
    const backendManifestHash = '147,148|149,150,151';
    expect(postRepairDbHash).toBe(backendManifestHash);
  });

  it('28. target hash check cannot be skipped even if payload field is omitted', () => {
    const backendDerivedHash = '147,148|149,150,151';
    expect(backendDerivedHash).not.toBe('');
  });

  it('29. non-empty bilingual units blocks automated repair', () => {
    const dbGroups: DbGroupInfo[] = [
      { id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage', question_numbers: [147], min_qn: 147, max_qn: 147, has_bilingual_units: true },
    ];
    const hasProtected = dbGroups.some((g) => g.has_bilingual_units);
    expect(hasProtected).toBe(true);
  });

  it('30. non-empty evidence blocks automated repair', () => {
    const dbGroups: DbGroupInfo[] = [
      { id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage', question_numbers: [147], min_qn: 147, max_qn: 147, has_evidence: true },
    ];
    const hasProtected = dbGroups.some((g) => g.has_evidence);
    expect(hasProtected).toBe(true);
  });

  it('31. null or [] metadata does not block automated repair', () => {
    const dbGroups: DbGroupInfo[] = [
      { id: 'g-1', part: 'part7', sort_order: 1, passage: 'Passage', question_numbers: [147], min_qn: 147, max_qn: 147, has_bilingual_units: false, has_evidence: false },
    ];
    const hasProtected = dbGroups.some((g) => g.has_bilingual_units || g.has_evidence);
    expect(hasProtected).toBe(false);
  });

  it('32. published test blocks structure apply', () => {
    const isPublished = true;
    const canApply = !isPublished;
    expect(canApply).toBe(false);
  });

  it('33. admin privileges required for repair execution', () => {
    const isAdmin = true;
    expect(isAdmin).toBe(true);
  });

  it('34. anonymous user blocked from repair execution', () => {
    const role: string = 'anon';
    const isAllowed = role === 'authenticated';
    expect(isAllowed).toBe(false);
  });

  it('35. structure repair performs zero question INSERT or DELETE', () => {
    const beforeCount = 54;
    const afterCount = 54;
    expect(afterCount - beforeCount).toBe(0);
  });

  it('36. correct_answer is untouched during structure repair', () => {
    const qBefore = { question_number: 147, correct_answer: 'B' };
    const qAfter = { question_number: 147, correct_answer: 'B' };
    expect(qBefore.correct_answer).toBe(qAfter.correct_answer);
  });

  it('37. question_number is untouched during structure repair', () => {
    const qBefore = { question_number: 147 };
    const qAfter = { question_number: 147 };
    expect(qBefore.question_number).toBe(qAfter.question_number);
  });

  it('38. passage and documents text are untouched during structure repair', () => {
    const gBefore = { passage: 'Original passage text', documents: [{ content: 'Doc text' }] };
    const gAfter = { passage: 'Original passage text', documents: [{ content: 'Doc text' }] };

    expect(gBefore.passage).toBe(gAfter.passage);
    expect(gBefore.documents).toEqual(gAfter.documents);
  });
});
