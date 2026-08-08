import { describe, it, expect } from 'vitest';
import {
  buildLearningRecommendations,
  normalizeToeicPart,
  selectBestMatchingLesson,
} from './recommendationEngine';
import { PublishedLessonInfo, buildDailyStudyPlan } from './dailyPlan';
import { LearningAnalysis } from './weaknessAnalysis';

describe('Phase 2.5B — Stabilize Personalized Recommendation Engine', () => {
  const mockGrammarLessons: PublishedLessonInfo[] = [
    { id: 'g-ps', kind: 'grammar', title: 'Present Simple — Hiện tại đơn', slug: 'present-simple-foundation', level: 'foundation', sort_order: 1 },
    { id: 'g-pv', kind: 'grammar', title: 'Passive Voice Intermediate', slug: 'passive-voice-inter', level: 'intermediate', sort_order: 2 },
  ];

  const mockLearningLessons: PublishedLessonInfo[] = [
    { id: 'l-p2', kind: 'listening', title: 'Part 2 Listening Foundation', slug: 'part-2-foundation', level: 'foundation', sort_order: 1, toeic_part: 'part2' },
    { id: 'r-p5a', kind: 'reading', title: 'Grammar Focus Incomplete Sentences A', slug: 'reading-practice-a', level: 'foundation', sort_order: 2, toeic_part: 'part5' }, // title does NOT contain "Part 5"
    { id: 'r-p5b', kind: 'reading', title: 'Grammar Focus Incomplete Sentences B', slug: 'reading-practice-b', level: 'foundation', sort_order: 1, toeic_part: 'part5' }, // sort_order 1
    { id: 'r-p5-inter', kind: 'reading', title: 'Intermediate Part 5 Drill', slug: 'reading-part-5-inter', level: 'intermediate', sort_order: 1, toeic_part: 'part5' },
    { id: 'r-p7-inter', kind: 'reading', title: 'Part 7 Reading Passages Inter', slug: 'part-7-reading-inter', level: 'intermediate', sort_order: 1, toeic_part: 'part7' },
  ];

  const mockAnalysis: LearningAnalysis = {
    overallMasteryPercent: 50,
    totalAttempts: 10,
    uniqueQuestions: 6,
    hasEnoughData: true,
    modules: [],
    toeicParts: [],
    skills: [],
    topics: [],
    focusAreas: [
      {
        dimension: 'skill',
        key: 'Present Simple',
        label: 'Present Simple',
        uniqueQuestionCount: 6,
        totalAttemptCount: 10,
        correctLatestCount: 3,
        unresolvedCount: 3,
        masteryPercent: 40,
        status: 'focus',
        confidence: 'medium',
      },
    ],
  };

  it('normalizeToeicPart helper cleans variants correctly', () => {
    expect(normalizeToeicPart('Part 5')).toBe('part5');
    expect(normalizeToeicPart('part 5')).toBe('part5');
    expect(normalizeToeicPart('part5')).toBe('part5');
    expect(normalizeToeicPart('5')).toBe('part5');
    expect(normalizeToeicPart(null)).toBeNull();
  });

  it('CASE A: Focus part5 matching lesson where title does NOT contain "Part 5" via explicit toeic_part metadata', () => {
    const part5Analysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'toeic_part', key: 'part5', label: 'TOEIC Part 5', uniqueQuestionCount: 8, totalAttemptCount: 12, correctLatestCount: 4, unresolvedCount: 4, masteryPercent: 50, status: 'focus', confidence: 'medium' },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: part5Analysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
    });

    expect(res.recommendations[0].type).toBe('reading_lesson');
    expect(res.recommendations[0].sourceLessonId).toBe('r-p5b'); // sort_order 1
  });

  it('CASE B: Focus part5 available Reading Part 7 only -> DO NOT recommend Part 7, fallback to /mistakes', () => {
    const part5Analysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'toeic_part', key: 'part5', label: 'TOEIC Part 5', uniqueQuestionCount: 8, totalAttemptCount: 12, correctLatestCount: 4, unresolvedCount: 4, masteryPercent: 50, status: 'focus', confidence: 'medium' },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: part5Analysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: [mockLearningLessons[4]], // Part 7 only
    });

    expect(res.recommendations[0].sourceLessonId).toBeUndefined();
    expect(res.recommendations[0].route).toBe('/mistakes');
    expect(res.recommendations[0].description).toContain('Hiện chưa có bài học TOEIC Part 5 phù hợp');
  });

  it('CASE C: Focus part2 available Listening part2 & Reading part2 -> Listening Part 2 selected only', () => {
    const part2Analysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'toeic_part', key: 'part2', label: 'TOEIC Part 2', uniqueQuestionCount: 8, totalAttemptCount: 12, correctLatestCount: 4, unresolvedCount: 4, masteryPercent: 50, status: 'focus', confidence: 'medium' },
      ],
    };

    const readingPart2: PublishedLessonInfo = { id: 'r-p2', kind: 'reading', title: 'Reading Part 2', slug: 'reading-p2', level: 'foundation', sort_order: 1, toeic_part: 'part2' };

    const res = buildLearningRecommendations({
      analysis: part2Analysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: [mockLearningLessons[0], readingPart2],
    });

    expect(res.recommendations[0].type).toBe('listening_lesson');
    expect(res.recommendations[0].sourceLessonId).toBe('l-p2');
  });

  it('CASE D: Focus part5, Student intermediate, Part 5 intermediate & foundation available -> intermediate selected', () => {
    const part5Analysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'toeic_part', key: 'part5', label: 'TOEIC Part 5', uniqueQuestionCount: 8, totalAttemptCount: 12, correctLatestCount: 4, unresolvedCount: 4, masteryPercent: 50, status: 'focus', confidence: 'medium' },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: part5Analysis,
      studentLevel: 'intermediate',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
    });

    expect(res.recommendations[0].sourceLessonId).toBe('r-p5-inter');
  });

  it('CASE E: Foundation student, Part 5 intermediate only available -> NEVER recommend it, fallback safely to /mistakes', () => {
    const part5Analysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'toeic_part', key: 'part5', label: 'TOEIC Part 5', uniqueQuestionCount: 8, totalAttemptCount: 12, correctLatestCount: 4, unresolvedCount: 4, masteryPercent: 50, status: 'focus', confidence: 'medium' },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: part5Analysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: [mockLearningLessons[3]], // Intermediate Part 5 only
    });

    expect(res.recommendations[0].sourceLessonId).toBeUndefined();
    expect(res.recommendations[0].route).toBe('/mistakes');
  });

  it('CASE F: Two Part 5 foundation lessons (A sort_order 2, B sort_order 1) -> B selected due to lower sort_order', () => {
    const part5Analysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'toeic_part', key: 'part5', label: 'TOEIC Part 5', uniqueQuestionCount: 8, totalAttemptCount: 12, correctLatestCount: 4, unresolvedCount: 4, masteryPercent: 50, status: 'focus', confidence: 'medium' },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: part5Analysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
    });

    expect(res.recommendations[0].sourceLessonId).toBe('r-p5b'); // sort_order 1
  });

  it('CASE G: B recently completed, A not recent -> A selected despite B lower sort_order', () => {
    const part5Analysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'toeic_part', key: 'part5', label: 'TOEIC Part 5', uniqueQuestionCount: 8, totalAttemptCount: 12, correctLatestCount: 4, unresolvedCount: 4, masteryPercent: 50, status: 'focus', confidence: 'medium' },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: part5Analysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
      recentlyCompletedLessonIds: new Set(['r-p5b']),
    });

    expect(res.recommendations[0].sourceLessonId).toBe('r-p5a');
  });

  it('CASE H: Only one Part 5 lesson exists and was completed recently -> may recommend same lesson again', () => {
    const part5Analysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'toeic_part', key: 'part5', label: 'TOEIC Part 5', uniqueQuestionCount: 8, totalAttemptCount: 12, correctLatestCount: 4, unresolvedCount: 4, masteryPercent: 50, status: 'focus', confidence: 'medium' },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: part5Analysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: [mockLearningLessons[1]], // r-p5a only
      recentlyCompletedLessonIds: new Set(['r-p5a']),
    });

    expect(res.recommendations[0].sourceLessonId).toBe('r-p5a');
  });

  it('CASE I: Grammar module focus, lessons arrive in random order -> selection determined by level, recent status, sort_order', () => {
    const randomOrderGrammar: PublishedLessonInfo[] = [
      { id: 'g-3', kind: 'grammar', title: 'Grammar 3', slug: 'g3', level: 'foundation', sort_order: 3 },
      { id: 'g-1', kind: 'grammar', title: 'Grammar 1', slug: 'g1', level: 'foundation', sort_order: 1 },
      { id: 'g-2', kind: 'grammar', title: 'Grammar 2', slug: 'g2', level: 'foundation', sort_order: 2 },
    ];

    const selected = selectBestMatchingLesson(randomOrderGrammar, 'foundation');
    expect(selected?.id).toBe('g-1');
  });

  it('CASE J: Daily Plan duplicate safety -> Continue lesson Grammar A & primary recommendation Grammar A -> ONLY 1 Grammar A item in plan', () => {
    const inProgressLesson = {
      content_type: 'grammar' as const,
      content_id: 'g-ps',
      title: 'Present Simple',
      slug: 'present-simple-foundation',
      status: 'in_progress' as const,
    };

    const recRes = buildLearningRecommendations({
      analysis: mockAnalysis, // Present Simple -> g-ps
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
    });

    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 0,
      vocabularyReviewedTodayCount: 0,
      unresolvedMistakeSummary: { totalUnresolved: 0, byCategory: {} },
      inProgressLesson,
      primaryRecommendation: recRes.primaryRecommendation,
    });

    // Should contain continue lesson, but NOT a duplicate personalized Grammar A item!
    const matchesGPS = plan.items.filter((i) => i.sourceLessonId === 'g-ps' || i.route.includes('present-simple'));
    expect(matchesGPS.length).toBe(1);
  });

  it('CASE K: Continue lesson Grammar A & primary recommendation Reading B -> both appear in plan if time caps allow', () => {
    const inProgressLesson = {
      content_type: 'grammar' as const,
      content_id: 'g-ps',
      title: 'Present Simple',
      slug: 'present-simple-foundation',
      status: 'in_progress' as const,
    };

    const part5Analysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'toeic_part', key: 'part5', label: 'TOEIC Part 5', uniqueQuestionCount: 8, totalAttemptCount: 12, correctLatestCount: 4, unresolvedCount: 4, masteryPercent: 50, status: 'focus', confidence: 'medium' },
      ],
    };

    const recRes = buildLearningRecommendations({
      analysis: part5Analysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
    });

    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 0,
      vocabularyReviewedTodayCount: 0,
      unresolvedMistakeSummary: { totalUnresolved: 0, byCategory: {} },
      inProgressLesson,
      primaryRecommendation: recRes.primaryRecommendation,
    });

    expect(plan.items.length).toBe(2);
    expect(plan.items[0].type).toBe('continue_lesson');
    expect(plan.items[1].type).toBe('reading_lesson');
  });

  it('CASE L: Personalized fallback /mistakes & existing mistake-review task exists -> do NOT add duplicate /mistakes', () => {
    const part5NoMatchAnalysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'toeic_part', key: 'part5', label: 'TOEIC Part 5', uniqueQuestionCount: 8, totalAttemptCount: 12, correctLatestCount: 4, unresolvedCount: 4, masteryPercent: 50, status: 'focus', confidence: 'medium' },
      ],
    };

    const recRes = buildLearningRecommendations({
      analysis: part5NoMatchAnalysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: [], // No reading lessons match
    });

    expect(recRes.primaryRecommendation?.route).toBe('/mistakes');

    const plan = buildDailyStudyPlan({
      vocabularyDueCount: 0,
      vocabularyReviewedTodayCount: 0,
      unresolvedMistakeSummary: { totalUnresolved: 3, byCategory: { grammar: 3 } }, // Creates plan-mistakes
      primaryRecommendation: recRes.primaryRecommendation,
    });

    const mistakeItems = plan.items.filter((i) => i.route === '/mistakes');
    expect(mistakeItems.length).toBe(1);
  });
});
