import { getVietnamDateKey, calculateStudyStreak } from './streak';

/**
 * Manual/Unit Verification runner for streak calculation.
 */
export function runStreakTests() {
  const refTime = '2026-08-08T12:00:00Z'; // Ref date: Aug 8, 2026

  // CASE A: Study today only -> Expected: 1
  const caseA = calculateStudyStreak(['2026-08-08T05:00:00Z'], refTime);
  console.assert(caseA === 1, `CASE A failed: got ${caseA}`);

  // CASE B: Study today + yesterday -> Expected: 2
  const caseB = calculateStudyStreak(['2026-08-08T05:00:00Z', '2026-08-07T10:00:00Z'], refTime);
  console.assert(caseB === 2, `CASE B failed: got ${caseB}`);

  // CASE C: Study yesterday but not today -> Expected: 1 (preserved!)
  const caseC = calculateStudyStreak(['2026-08-07T10:00:00Z'], refTime);
  console.assert(caseC === 1, `CASE C failed: got ${caseC}`);

  // CASE D: Study 2 days ago only -> Expected: 0
  const caseD = calculateStudyStreak(['2026-08-06T10:00:00Z'], refTime);
  console.assert(caseD === 0, `CASE D failed: got ${caseD}`);

  // CASE E: Vocab today + Grammar quiz today -> Expected: 1
  const caseE = calculateStudyStreak(['2026-08-08T02:00:00Z', '2026-08-08T08:00:00Z'], refTime);
  console.assert(caseE === 1, `CASE E failed: got ${caseE}`);

  // CASE F: Vocab yesterday + Reading today -> Expected: 2
  const caseF = calculateStudyStreak(['2026-08-07T08:00:00Z', '2026-08-08T02:00:00Z'], refTime);
  console.assert(caseF === 2, `CASE F failed: got ${caseF}`);

  // CASE G: Activity shortly after midnight Vietnam time (00:05 VN = Aug 7 17:05 UTC)
  // Aug 7 17:05 UTC in VN timezone is Aug 8 00:05 AM -> Should be Aug 8 key!
  const vnKey = getVietnamDateKey('2026-08-07T17:05:00Z');
  console.assert(vnKey === '2026-08-08', `CASE G vnKey failed: got ${vnKey}`);

  console.log('[ORI Streak Tests] All test cases passed!');
}
