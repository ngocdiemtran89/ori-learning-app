import { describe, it, expect } from 'vitest';
import { getVietnamDateKey, calculateStudyStreak } from './streak';

describe('Streak Calculation & Vietnam Timezone (Asia/Ho_Chi_Minh)', () => {
  const refTime = '2026-08-08T12:00:00Z'; // Reference Date: Aug 8, 2026

  it('CASE A: Study today only -> Expected streak = 1', () => {
    const streak = calculateStudyStreak(['2026-08-08T05:00:00Z'], refTime);
    expect(streak).toBe(1);
  });

  it('CASE B: Study today + yesterday -> Expected streak = 2', () => {
    const streak = calculateStudyStreak(['2026-08-08T05:00:00Z', '2026-08-07T10:00:00Z'], refTime);
    expect(streak).toBe(2);
  });

  it('CASE C: Study yesterday but not today -> Expected streak = 1 (preserved)', () => {
    const streak = calculateStudyStreak(['2026-08-07T10:00:00Z'], refTime);
    expect(streak).toBe(1);
  });

  it('CASE D: Study 2 days ago only -> Expected streak = 0', () => {
    const streak = calculateStudyStreak(['2026-08-06T10:00:00Z'], refTime);
    expect(streak).toBe(0);
  });

  it('CASE E: Vocabulary today + Grammar quiz today -> Expected streak = 1 (no double counting)', () => {
    const streak = calculateStudyStreak(
      ['2026-08-08T02:00:00Z', '2026-08-08T08:00:00Z'],
      refTime
    );
    expect(streak).toBe(1);
  });

  it('CASE F: Vocabulary yesterday + Reading today -> Expected streak = 2', () => {
    const streak = calculateStudyStreak(
      ['2026-08-07T08:00:00Z', '2026-08-08T02:00:00Z'],
      refTime
    );
    expect(streak).toBe(2);
  });

  it('CASE G: Activity shortly after midnight Vietnam time (00:05 AM ICT = 17:05 UTC prev day)', () => {
    // Aug 7 17:05 UTC in Asia/Ho_Chi_Minh is Aug 8 00:05 AM -> Should format as 2026-08-08!
    const vnKey = getVietnamDateKey('2026-08-07T17:05:00Z');
    expect(vnKey).toBe('2026-08-08');
  });
});
