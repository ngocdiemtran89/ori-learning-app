import { describe, it, expect } from 'vitest';
import {
  buildDailyStudyPlan,
  calculateUnresolvedMistakes,
  PublishedLessonInfo,
} from './dailyPlan';

describe('Phase 2.3 — Daily Study Plan Engine', () => {
  const mockLessons: PublishedLessonInfo[] = [
    { id: 'g1', kind: 'grammar', title: 'Present Simple', slug: 'present-simple', level: 'foundation', sort_order: 1 },
    { id: 'l1', kind: 'listening', title: 'Part 2 Listening', slug: 'part-2-listening', level: 'foundation', sort_order: 1 },
    { id: 'r1', kind: 'reading', title: 'Part 5 Reading', slug: 'part-5-reading', level: 'foundation', sort_order: 1 },
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
        content_id: 'g1',
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
        content_id: 'r1',
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

  it('CASE E: Very large workload (200 vocab, 50 mistakes) -> Cap at 20 vocab, 5 mistakes, max 4 items, reasonable duration', () => {
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
});
