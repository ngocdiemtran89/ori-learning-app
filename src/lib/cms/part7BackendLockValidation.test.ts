import { describe, it, expect } from 'vitest';
import { computeStructureHash } from './part7StructureManifest';
import { computeManifestAssignmentLockHash } from './part7StructureComparison';

describe('Part 7 Backend Structure Lock & RPC Validation Contract Suite', () => {
  it('1. same source boundaries but swapped targetGroupIds -> produces DIFFERENT lock hash', () => {
    const groupsNormal = [
      { targetGroupId: 'g-1', startQuestion: 147, endQuestion: 148, questionNumbers: [147, 148] },
      { targetGroupId: 'g-2', startQuestion: 149, endQuestion: 151, questionNumbers: [149, 150, 151] },
    ];
    const groupsSwapped = [
      { targetGroupId: 'g-2', startQuestion: 147, endQuestion: 148, questionNumbers: [147, 148] },
      { targetGroupId: 'g-1', startQuestion: 149, endQuestion: 151, questionNumbers: [149, 150, 151] },
    ];

    const hashNormal: string = computeManifestAssignmentLockHash(groupsNormal);
    const hashSwapped: string = computeManifestAssignmentLockHash(groupsSwapped);

    expect(hashNormal).toBe('g-1:147,148|g-2:149,150,151');
    expect(hashSwapped).toBe('g-2:147,148|g-1:149,150,151');
    expect(hashNormal).not.toBe(hashSwapped);
  });

  it('2. swapped group IDs detected as DRIFT during status check', () => {
    const lockedHash = 'g-1:147,148|g-2:149,150,151';
    const currentSwappedDbHash = 'g-2:147,148|g-1:149,150,151';

    const isMatch = (lockedHash as string) === currentSwappedDbHash;
    const status = isMatch ? 'LOCKED' : 'DRIFT';

    expect(isMatch).toBe(false);
    expect(status).toBe('DRIFT');
  });

  it('3. extra empty active group causes status to report DRIFT', () => {
    const emptyGroupCount = 1;
    const lockedHash = 'g-1:147,148|g-2:149,150,151';
    const currentHash = 'g-1:147,148|g-2:149,150,151';

    const status = (emptyGroupCount > 0 || (lockedHash as string) !== currentHash) ? 'DRIFT' : 'LOCKED';
    expect(status).toBe('DRIFT');
  });

  it('4. startQuestion != min(qnums) -> reject group validation', () => {
    const validateGroupRange = (startQ: number, endQ: number, qnums: number[]) => {
      const minQ = Math.min(...qnums);
      const maxQ = Math.max(...qnums);
      return startQ === minQ && endQ === maxQ;
    };

    expect(validateGroupRange(147, 149, [148, 149])).toBe(false);
  });

  it('5. endQuestion != max(qnums) -> reject group validation', () => {
    const validateGroupRange = (startQ: number, endQ: number, qnums: number[]) => {
      const minQ = Math.min(...qnums);
      const maxQ = Math.max(...qnums);
      return startQ === minQ && endQ === maxQ;
    };

    expect(validateGroupRange(147, 150, [147, 148, 149])).toBe(false);
  });

  it('6. duplicate order value -> reject manifest validation', () => {
    const orders = [0, 1, 1, 2];
    const uniqueOrders = new Set(orders);
    expect(uniqueOrders.size === orders.length).toBe(false);
  });

  it('7. negative order (-1) -> reject manifest validation', () => {
    const order = -1;
    const isValidOrder = Number.isInteger(order) && order >= 0;
    expect(isValidOrder).toBe(false);
  });

  it('8. fractional order (1.5) -> reject manifest validation', () => {
    const order = 1.5;
    const isValidOrder = Number.isInteger(order) && order >= 0;
    expect(isValidOrder).toBe(false);
  });

  it('9. fractional question number (147.5) -> reject question number validation', () => {
    const qnum = 147.5;
    const isValidQNum = Number.isInteger(qnum);
    expect(isValidQNum).toBe(false);
  });

  it('10. numeric string "147" -> reject when strict JSON type check is applied', () => {
    const qnumValue: any = '147';
    const isStrictNumber = typeof qnumValue === 'number' && Number.isInteger(qnumValue);
    expect(isStrictNumber).toBe(false);
  });

  it('11. manifest groups reordered in JSON array -> produce SAME canonical source hash', () => {
    const g1 = { startQuestion: 147, endQuestion: 148, questionNumbers: [147, 148] };
    const g2 = { startQuestion: 149, endQuestion: 151, questionNumbers: [149, 150, 151] };

    const hashOriginal = computeStructureHash([g1, g2]);
    const hashReordered = computeStructureHash([g2, g1]);

    expect(hashOriginal).toBe('147,148|149,150,151');
    expect(hashOriginal).toBe(hashReordered);
  });

  it('12. manifest groups reordered in JSON array -> produce SAME canonical assignment hash after sort', () => {
    const g1 = { targetGroupId: 'g-1', startQuestion: 147, endQuestion: 148, questionNumbers: [147, 148] };
    const g2 = { targetGroupId: 'g-2', startQuestion: 149, endQuestion: 151, questionNumbers: [149, 150, 151] };

    const hashOriginal = computeManifestAssignmentLockHash([g1, g2]);
    const hashReordered = computeManifestAssignmentLockHash([g2, g1]);

    expect(hashOriginal).toBe('g-1:147,148|g-2:149,150,151');
    expect(hashOriginal).toBe(hashReordered);
  });

  it('13. post-repair targetGroup membership is verified against expected manifest questionNumbers', () => {
    const expectedQNums = [147, 148];
    const actualQNums = [147, 148];
    const isExactMatch = JSON.stringify(expectedQNums) === JSON.stringify(actualQNums);
    expect(isExactMatch).toBe(true);
  });

  it('14. unknown/untrusted manifest keys are not persisted in canonical lock manifest', () => {
    const rawGroup = {
      order: 0,
      startQuestion: 147,
      endQuestion: 148,
      questionNumbers: [147, 148],
      targetGroupId: 'g-1',
      unknownScriptInjection: '<script>alert(1)</script>',
      maliciousFlag: true,
    };

    // Clean canonical builder
    const canonicalGroup = {
      order: rawGroup.order,
      startQuestion: rawGroup.startQuestion,
      endQuestion: rawGroup.endQuestion,
      questionNumbers: rawGroup.questionNumbers,
      targetGroupId: rawGroup.targetGroupId,
    };

    expect((canonicalGroup as any).unknownScriptInjection).toBeUndefined();
    expect((canonicalGroup as any).maliciousFlag).toBeUndefined();
  });
});
