import { describe, it, expect } from 'vitest';
import { buildPart7StructureManifest, computeStructureHash } from './part7StructureManifest';
import { Part7DetectedStructureGroup } from './part7StructureParser';

describe('Part 7 Structure Manifest & Fingerprint Suite', () => {
  const createMockGroup = (startQ: number, endQ: number): Part7DetectedStructureGroup => {
    const qNums: number[] = [];
    for (let q = startQ; q <= endQ; q++) qNums.push(q);
    return {
      sourceOrder: startQ,
      startQuestion: startQ,
      endQuestion: endQ,
      questionNumbers: qNums,
      sourceHeader: `Questions ${startQ}–${endQ} refer to...`,
      status: 'complete',
    };
  };

  const createComplete54Groups = (): Part7DetectedStructureGroup[] => [
    createMockGroup(147, 148), // 2
    createMockGroup(149, 151), // 3
    createMockGroup(152, 154), // 3
    createMockGroup(155, 157), // 3
    createMockGroup(158, 160), // 3
    createMockGroup(161, 164), // 4
    createMockGroup(165, 168), // 4
    createMockGroup(169, 172), // 4
    createMockGroup(173, 175), // 3
    createMockGroup(176, 180), // 5
    createMockGroup(181, 185), // 5
    createMockGroup(186, 190), // 5
    createMockGroup(191, 195), // 5
    createMockGroup(196, 200), // 5 (Total = 54)
  ];

  it('18. complete Q147-200 (54 questions) produces valid manifest', () => {
    const groups = createComplete54Groups();
    const res = buildPart7StructureManifest(groups);

    expect(res.isValid).toBe(true);
    expect(res.manifest).not.toBeNull();
    expect(res.totalQuestionsFound).toBe(54);
    expect(res.errors.length).toBe(0);
    expect(res.manifest?.structureHash).toBe('147-148|149-151|152-154|155-157|158-160|161-164|165-168|169-172|173-175|176-180|181-185|186-190|191-195|196-200');
  });

  it('19. missing Q173 marks manifest as invalid', () => {
    const groups = createComplete54Groups();
    // Remove group 173-175
    const incomplete = groups.filter((g) => g.startQuestion !== 173);
    const res = buildPart7StructureManifest(incomplete);

    expect(res.isValid).toBe(false);
    expect(res.missingQuestions).toContain(173);
    expect(res.errors.some((e) => e.includes('Thiếu 3 câu'))).toBe(true);
  });

  it('20. duplicate Q173 across groups marks manifest as invalid', () => {
    const groups = createComplete54Groups();
    // Duplicate Q173 in group 169-172
    groups[7].questionNumbers.push(173);
    const res = buildPart7StructureManifest(groups);

    expect(res.isValid).toBe(false);
    expect(res.duplicateQuestions).toContain(173);
    expect(res.overlappingGroups.length).toBeGreaterThan(0);
  });

  it('21. Q146 out of range marks manifest as invalid', () => {
    const groups = createComplete54Groups();
    groups[0].questionNumbers.unshift(146);
    const res = buildPart7StructureManifest(groups);

    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.includes('Q146 nằm ngoài dải quy định'))).toBe(true);
  });

  it('22. Q201 out of range marks manifest as invalid', () => {
    const groups = createComplete54Groups();
    groups[groups.length - 1].questionNumbers.push(201);
    const res = buildPart7StructureManifest(groups);

    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.includes('Q201 nằm ngoài dải quy định'))).toBe(true);
  });

  it('23. exact 54 unique questions required for valid manifest', () => {
    const groups = createComplete54Groups().slice(0, 10); // Only 34 questions
    const res = buildPart7StructureManifest(groups);

    expect(res.isValid).toBe(false);
    expect(res.totalQuestionsFound).toBe(34);
    expect(res.errors.some((e) => e.includes('34/54'))).toBe(true);
  });

  it('24. structureHash is deterministic regardless of array input order', () => {
    const groups = createComplete54Groups();
    const shuffled = [...groups].reverse();

    const hash1 = computeStructureHash(groups);
    const hash2 = computeStructureHash(shuffled);

    expect(hash1).toBe(hash2);
  });

  it('25. same structure with different passage text produces identical structureHash', () => {
    const groups1 = createMockGroup(147, 148);
    groups1.passageText = 'Passage A Text';

    const groups2 = createMockGroup(147, 148);
    groups2.passageText = 'Passage B Text (Different text)';

    const hash1 = computeStructureHash([groups1]);
    const hash2 = computeStructureHash([groups2]);

    expect(hash1).toBe(hash2);
  });

  it('26. changed group boundary produces different structureHash', () => {
    const hashOriginal = computeStructureHash([
      { startQuestion: 147, endQuestion: 148 },
      { startQuestion: 149, endQuestion: 151 },
    ]);

    const hashModified = computeStructureHash([
      { startQuestion: 147, endQuestion: 149 },
      { startQuestion: 150, endQuestion: 151 },
    ]);

    expect(hashOriginal).not.toBe(hashModified);
  });
});
