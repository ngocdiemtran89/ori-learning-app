import { describe, it, expect } from 'vitest';
import { buildLearningRecommendations } from './recommendationEngine';
import { PublishedLessonInfo } from './dailyPlan';
import { LearningAnalysis } from './weaknessAnalysis';

describe('Phase 2.5 — Deterministic Recommendation Engine', () => {
  const mockGrammarLessons: PublishedLessonInfo[] = [
    { id: 'g-ps', kind: 'grammar', title: 'Present Simple — Hiện tại đơn', slug: 'present-simple-foundation', level: 'foundation', sort_order: 1 },
    { id: 'g-pv', kind: 'grammar', title: 'Passive Voice Intermediate', slug: 'passive-voice-inter', level: 'intermediate', sort_order: 2 },
  ];

  const mockLearningLessons: PublishedLessonInfo[] = [
    { id: 'l-p2', kind: 'listening', title: 'Part 2 Listening Foundation', slug: 'part-2-foundation', level: 'foundation', sort_order: 1 },
    { id: 'r-p5a', kind: 'reading', title: 'Part 5 Incomplete Sentences A', slug: 'part-5-sentences-a', level: 'foundation', sort_order: 1 },
    { id: 'r-p5b', kind: 'reading', title: 'Part 5 Incomplete Sentences B', slug: 'part-5-sentences-b', level: 'foundation', sort_order: 2 },
    { id: 'r-p7-inter', kind: 'reading', title: 'Part 7 Reading Passages Inter', slug: 'part-7-reading-inter', level: 'intermediate', sort_order: 1 },
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

  it('CASE A — Grammar mapping: skill Present Simple (40% mastery) maps to foundation Grammar lesson', () => {
    const res = buildLearningRecommendations({
      analysis: mockAnalysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
    });

    expect(res.hasPersonalizedData).toBe(true);
    expect(res.recommendations.length).toBe(1);
    expect(res.recommendations[0].type).toBe('grammar_lesson');
    expect(res.recommendations[0].route).toBe('/grammar/present-simple-foundation');
    expect(res.recommendations[0].sourceLessonId).toBe('g-ps');
  });

  it('CASE B — Level safety: Foundation student matching intermediate lesson ONLY -> NEVER recommends it, falls back to mistakes', () => {
    const interAnalysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        {
          dimension: 'skill',
          key: 'Passive Voice',
          label: 'Passive Voice',
          uniqueQuestionCount: 6,
          totalAttemptCount: 10,
          correctLatestCount: 2,
          unresolvedCount: 4,
          masteryPercent: 33,
          status: 'focus',
          confidence: 'medium',
        },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: interAnalysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons, // Passive Voice is intermediate
      publishedLearningLessons: mockLearningLessons,
    });

    expect(res.recommendations[0].sourceLessonId).not.toBe('g-pv');
    expect(res.recommendations[0].route).toBe('/mistakes');
  });

  it('CASE C — TOEIC Part 2: Focus part2 maps to foundation Listening Part 2 lesson', () => {
    const part2Analysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        {
          dimension: 'toeic_part',
          key: 'part2',
          label: 'TOEIC Part 2',
          uniqueQuestionCount: 8,
          totalAttemptCount: 12,
          correctLatestCount: 4,
          unresolvedCount: 4,
          masteryPercent: 50,
          status: 'focus',
          confidence: 'medium',
        },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: part2Analysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
    });

    expect(res.recommendations[0].type).toBe('listening_lesson');
    expect(res.recommendations[0].route).toContain('/listening/');
  });

  it('CASE D — TOEIC Part 5: Focus part5 maps to foundation Reading Part 5 lesson', () => {
    const part5Analysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        {
          dimension: 'toeic_part',
          key: 'part5',
          label: 'TOEIC Part 5',
          uniqueQuestionCount: 8,
          totalAttemptCount: 12,
          correctLatestCount: 4,
          unresolvedCount: 4,
          masteryPercent: 50,
          status: 'focus',
          confidence: 'medium',
        },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: part5Analysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
    });

    expect(res.recommendations[0].type).toBe('reading_lesson');
    expect(res.recommendations[0].route).toContain('/reading/');
  });

  it('CASE E — Insufficient data: hasEnoughData = false -> primaryRecommendation = null, hasPersonalizedData = false', () => {
    const insufficientAnalysis: LearningAnalysis = {
      ...mockAnalysis,
      hasEnoughData: false,
      focusAreas: [],
    };

    const res = buildLearningRecommendations({
      analysis: insufficientAnalysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
    });

    expect(res.hasPersonalizedData).toBe(false);
    expect(res.primaryRecommendation).toBeNull();
    expect(res.recommendations.length).toBe(0);
  });

  it('CASE G — Completed recently: Prefer uncompleted Lesson B over recently completed Lesson A', () => {
    const part5Analysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        {
          dimension: 'toeic_part',
          key: 'part5',
          label: 'TOEIC Part 5',
          uniqueQuestionCount: 8,
          totalAttemptCount: 12,
          correctLatestCount: 4,
          unresolvedCount: 4,
          masteryPercent: 50,
          status: 'focus',
          confidence: 'medium',
        },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: part5Analysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
      recentlyCompletedLessonIds: new Set(['r-p5a']),
    });

    expect(res.recommendations[0].sourceLessonId).toBe('r-p5b');
  });

  it('CASE H — Only one relevant lesson: If only Lesson A exists and was completed recently, it can still be recommended if mastery is focus', () => {
    const res = buildLearningRecommendations({
      analysis: mockAnalysis, // Present Simple
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
      recentlyCompletedLessonIds: new Set(['g-ps']),
    });

    expect(res.recommendations.length).toBe(1);
    expect(res.recommendations[0].sourceLessonId).toBe('g-ps');
  });

  it('CASE I — Max recommendations: Capped at 3', () => {
    const multiAnalysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'skill', key: 'Present Simple', label: 'Present Simple', uniqueQuestionCount: 6, totalAttemptCount: 10, correctLatestCount: 2, unresolvedCount: 4, masteryPercent: 33, status: 'focus', confidence: 'medium' },
        { dimension: 'toeic_part', key: 'part2', label: 'TOEIC Part 2', uniqueQuestionCount: 6, totalAttemptCount: 10, correctLatestCount: 2, unresolvedCount: 4, masteryPercent: 33, status: 'focus', confidence: 'medium' },
        { dimension: 'toeic_part', key: 'part5', label: 'TOEIC Part 5', uniqueQuestionCount: 6, totalAttemptCount: 10, correctLatestCount: 2, unresolvedCount: 4, masteryPercent: 33, status: 'focus', confidence: 'medium' },
        { dimension: 'topic', key: 'Office', label: 'Office', uniqueQuestionCount: 6, totalAttemptCount: 10, correctLatestCount: 2, unresolvedCount: 4, masteryPercent: 33, status: 'focus', confidence: 'medium' },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: multiAnalysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
    });

    expect(res.recommendations.length).toBeLessThanOrEqual(3);
  });

  it('CASE K — No duplicate lesson recommendations: Two focus areas resolving to same route deduplicate to single recommendation', () => {
    const dupeAnalysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'skill', key: 'Present Simple', label: 'Present Simple', uniqueQuestionCount: 6, totalAttemptCount: 10, correctLatestCount: 2, unresolvedCount: 4, masteryPercent: 33, status: 'focus', confidence: 'medium' },
        { dimension: 'skill', key: 'Present Simple', label: 'Present Simple', uniqueQuestionCount: 6, totalAttemptCount: 10, correctLatestCount: 2, unresolvedCount: 4, masteryPercent: 33, status: 'focus', confidence: 'medium' },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: dupeAnalysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
    });

    expect(res.recommendations.length).toBe(1);
  });

  it('CASE J — Priority ranking: Weak skill + weak Part + weak Topic -> Skill > Part > Topic priority order', () => {
    const multiAnalysis: LearningAnalysis = {
      ...mockAnalysis,
      focusAreas: [
        { dimension: 'skill', key: 'Present Simple', label: 'Present Simple', uniqueQuestionCount: 6, totalAttemptCount: 10, correctLatestCount: 2, unresolvedCount: 4, masteryPercent: 33, status: 'focus', confidence: 'medium' },
        { dimension: 'toeic_part', key: 'part2', label: 'TOEIC Part 2', uniqueQuestionCount: 6, totalAttemptCount: 10, correctLatestCount: 2, unresolvedCount: 4, masteryPercent: 33, status: 'focus', confidence: 'medium' },
        { dimension: 'topic', key: 'Office', label: 'Office', uniqueQuestionCount: 6, totalAttemptCount: 10, correctLatestCount: 2, unresolvedCount: 4, masteryPercent: 33, status: 'focus', confidence: 'medium' },
      ],
    };

    const res = buildLearningRecommendations({
      analysis: multiAnalysis,
      studentLevel: 'foundation',
      publishedGrammarLessons: mockGrammarLessons,
      publishedLearningLessons: mockLearningLessons,
    });

    expect(res.recommendations[0].reason).toBe('weak_skill');
    expect(res.recommendations[1].reason).toBe('weak_toeic_part');
    expect(res.recommendations[2].reason).toBe('weak_topic');
  });
});
