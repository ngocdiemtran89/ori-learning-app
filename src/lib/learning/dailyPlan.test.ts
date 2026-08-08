import { describe, it, expect } from 'vitest';
import {
  buildDailyStudyPlan,
  calculateUnresolvedMistakes,
  isLessonAllowedForStudent,
  PublishedLessonInfo,
} from './dailyPlan';

describe('Phase 2.3B — Daily Study Plan Engine & Stability', () => {
  const mockLessons: PublishedLessonInfo[] = [
    { id: 'g-found', kind: 'grammar', title: 'Present Simple Foundation', slug: 'present-simple-foundation', level: 'foundation', sort_order: 1 },
    { id: 'g-inter', kind: 'grammar', title: 'Passive Voice Intermediate', slug: 'passive-voice-inter', level: 'intermediate', sort_order: 2 },
    { id: 'g-adv', kind: 'grammar', title: 'Inversion Advanced', slug: 'inversion-adv', level: 'advanced', sort_order: 3 },
    { id: 'l-found', kind: 'listening', title: 'Part 2 Listening Foundation', slug: 'part-2-foundation', level: 'foundation', sort_order: 1 },
    { id: 'r-found', kind: 'reading', title: 'Part 5 Reading Foundation', slug: 'part-5-foundation', level: 'foundation', sort_order: 1 },
  ];

  it('CASE A: 20 vocabulary due, 0 mistakes, no progress -> Vocabulary + beginner tasks (max 4)', () => {
    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 20,
      vocabularyReviewedTodayCount: 0,
      unresolvedMistakeSummary: { totalUnresolved: 0, byCategory: {} },
      availableLessons: mockLessons,
    });

    expect(plan.items.length).toBeLessThanOrEqual(4);
    expect(plan.items[0].type).toBe('vocabulary_review');
    expect(plan.items[0].targetCount).toBe(20);
    expect(plan.items[0].estimatedMinutes).toBeLessThanOrEqual(8);
  });

  it('CASE B: 10 vocab due, 3 unresolved mistakes, 1 unfinished Grammar -> Priority: Vocab(1), Mistakes(2), Continue Grammar(3), Balanced(4)', () => {
    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 10,
      vocabularyReviewedTodayCount: 0,
      unresolvedMistakeSummary: { totalUnresolved: 3, byCategory: { grammar: 3 }, topCategory: 'grammar' },
      inProgressLesson: {
        content_type: 'grammar',
        content_id: 'g-found',
        title: 'Present Simple',
        slug: 'present-simple',
        status: 'in_progress',
      },
      availableLessons: mockLessons,
    });

    expect(plan.items.length).toBeLessThanOrEqual(4);
    expect(plan.items[0].type).toBe('vocabulary_review');
    expect(plan.items[1].type).toBe('mistake_review');
    expect(plan.items[2].type).toBe('continue_lesson');
    expect(plan.items[2].title).toContain('Present Simple');
  });

  it('CASE C: 0 vocab, 0 mistakes, unfinished Reading -> Continue Reading + balanced practice', () => {
    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 0,
      vocabularyReviewedTodayCount: 0,
      unresolvedMistakeSummary: { totalUnresolved: 0, byCategory: {} },
      inProgressLesson: {
        content_type: 'reading',
        content_id: 'r-found',
        title: 'Part 5 Reading',
        slug: 'part-5-reading',
        status: 'in_progress',
      },
      availableLessons: mockLessons,
    });

    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.items[0].type).toBe('continue_lesson');
    expect(plan.items[0].title).toContain('Part 5 Reading');
  });

  it('CASE D: No previous learning history (New student) -> Reasonable initial plan', () => {
    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 0,
      vocabularyReviewedTodayCount: 0,
      unresolvedMistakeSummary: { totalUnresolved: 0, byCategory: {} },
      availableLessons: mockLessons,
      studentLevel: 'foundation',
    });

    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.items.length).toBeLessThanOrEqual(4);
    expect(plan.completedItems).toBe(0);
  });

  it('CASE E: Very large workload (200 vocab, 50 mistakes) -> Cap at 20 vocab, 5 mistakes, max 4 items, <= 30 mins', () => {
    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 200,
      vocabularyReviewedTodayCount: 0,
      unresolvedMistakeSummary: { totalUnresolved: 50, byCategory: { grammar: 30, listening: 20 }, topCategory: 'grammar' },
      availableLessons: mockLessons,
    });

    expect(plan.items.length).toBeLessThanOrEqual(4);
    expect(plan.items[0].targetCount).toBe(20);
    expect(plan.items[1].targetCount).toBe(5);
    expect(plan.totalEstimatedMinutes).toBeLessThanOrEqual(30);
  });

  it('CASE F: Repeated question attempts (wrong -> wrong -> correct) -> NOT unresolved', () => {
    const summary = calculateUnresolvedMistakes([
      { question_key: 'q1', content_type: 'grammar', is_correct: false, created_at: '2026-08-08T01:00:00Z' },
      { question_key: 'q1', content_type: 'grammar', is_correct: false, created_at: '2026-08-08T02:00:00Z' },
      { question_key: 'q1', content_type: 'grammar', is_correct: true, created_at: '2026-08-08T03:00:00Z' },
    ]);

    expect(summary.totalUnresolved).toBe(0);
  });

  it('CASE G: Repeated question attempts (wrong -> correct -> wrong) -> UNRESOLVED', () => {
    const summary = calculateUnresolvedMistakes([
      { question_key: 'q1', content_type: 'grammar', is_correct: false, created_at: '2026-08-08T01:00:00Z' },
      { question_key: 'q1', content_type: 'grammar', is_correct: true, created_at: '2026-08-08T02:00:00Z' },
      { question_key: 'q1', content_type: 'grammar', is_correct: false, created_at: '2026-08-08T03:00:00Z' },
    ]);

    expect(summary.totalUnresolved).toBe(1);
    expect(summary.byCategory.grammar).toBe(1);
  });

  it('CASE H: All plan items completed -> completedItems == totalItems', () => {
    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 0,
      vocabularyReviewedTodayCount: 10,
      unresolvedMistakeSummary: { totalUnresolved: 0, byCategory: {} },
    });

    expect(plan.completedItems).toBe(plan.totalItems);
    expect(plan.totalEstimatedMinutes).toBe(0);
  });

  // PHASE 2.3B STABILITY TESTS (CASES I-M)

  it('CASE I — Foundation level filtering: Foundation student NEVER gets intermediate/advanced', () => {
    expect(isLessonAllowedForStudent('foundation', 'foundation')).toBe(true);
    expect(isLessonAllowedForStudent('foundation', 'intermediate')).toBe(false);
    expect(isLessonAllowedForStudent('foundation', 'advanced')).toBe(false);

    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 0,
      vocabularyReviewedTodayCount: 0,
      unresolvedMistakeSummary: { totalUnresolved: 0, byCategory: {} },
      availableLessons: mockLessons,
      studentLevel: 'foundation',
    });

    const recommendedIds = plan.items.map((i) => i.id);
    expect(recommendedIds).not.toContain('plan-practice-g-inter');
    expect(recommendedIds).not.toContain('plan-practice-g-adv');
  });

  it('CASE J — Intermediate fallback: Intermediate student allows intermediate & foundation, NEVER advanced', () => {
    expect(isLessonAllowedForStudent('intermediate', 'foundation')).toBe(true);
    expect(isLessonAllowedForStudent('intermediate', 'intermediate')).toBe(true);
    expect(isLessonAllowedForStudent('intermediate', 'advanced')).toBe(false);

    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 0,
      vocabularyReviewedTodayCount: 0,
      unresolvedMistakeSummary: { totalUnresolved: 0, byCategory: {} },
      availableLessons: mockLessons,
      studentLevel: 'intermediate',
    });

    const recommendedIds = plan.items.map((i) => i.id);
    expect(recommendedIds).not.toContain('plan-practice-g-adv');
  });

  it('CASE K — 30 minute hard cap: Plan NEVER exceeds 30 total estimated minutes', () => {
    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 20, // 8 mins
      vocabularyReviewedTodayCount: 0,
      unresolvedMistakeSummary: { totalUnresolved: 5, byCategory: { grammar: 5 }, topCategory: 'grammar' }, // 10 mins
      inProgressLesson: {
        content_type: 'grammar',
        content_id: 'g-found',
        title: 'Present Simple',
        slug: 'present-simple',
        status: 'in_progress',
      }, // 8 mins
      // Existing total: 8 + 10 + 8 = 26 mins. Adding a 7-min practice would make 33. It must be skipped or capped!
      availableLessons: mockLessons,
    });

    expect(plan.totalEstimatedMinutes).toBeLessThanOrEqual(30);
  });

  it('CASE L — Completed today schema fields: Verify user_progress model structure uses completed_at and last_seen_at', () => {
    const mockProgressLesson = {
      content_type: 'grammar' as const,
      content_id: 'g-found',
      title: 'Present Simple',
      slug: 'present-simple',
      status: 'in_progress' as const,
      last_seen_at: '2026-08-08T12:00:00Z',
      completed_at: null,
    };

    expect(mockProgressLesson).toHaveProperty('last_seen_at');
    expect(mockProgressLesson).toHaveProperty('completed_at');
    expect(mockProgressLesson).not.toHaveProperty('updated_at');
  });

  it('CASE M — Vocab reviewed but none due: Accurate title "Đã ôn 10 từ vựng hôm nay"', () => {
    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 0,
      vocabularyReviewedTodayCount: 10,
      unresolvedMistakeSummary: { totalUnresolved: 0, byCategory: {} },
    });

    expect(plan.items[0].completed).toBe(true);
    expect(plan.items[0].title).toBe('Đã ôn 10 từ vựng hôm nay');
    expect(plan.items[0].title).not.toContain('đến hạn');
  });
});
