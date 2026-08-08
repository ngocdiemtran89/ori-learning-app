import { describe, it, expect } from 'vitest';
import {
  summarizeStudentProgress,
  getVietnamDateKey,
  RawStudentProgressData,
} from './studentProgressSummary';
import { LearningAnalysis } from './weaknessAnalysis';

describe('Phase 2.6 — Student Progress Summary Engine', () => {
  const mockNow = new Date('2026-08-08T12:00:00+07:00'); // Saturday 12:00 PM Vietnam time

  const mockAnalysis: LearningAnalysis = {
    overallMasteryPercent: 71,
    totalAttempts: 20,
    uniqueQuestions: 15,
    hasEnoughData: true,
    modules: [],
    toeicParts: [],
    skills: [],
    topics: [],
    focusAreas: [],
  };

  const emptyRawData: RawStudentProgressData = {
    studentProfile: {
      id: 'st-1',
      role: 'student',
      full_name: 'Nguyen Van A',
      level: 'foundation',
      status: 'active',
      access_start_at: '2026-08-01T00:00:00Z',
      access_expires_at: '2026-09-01T00:00:00Z',
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
    vocabularyReviews: [],
    quizAttempts: [],
    questionAttempts: [],
    userProgress: [],
    analysis: mockAnalysis,
    recommendations: { recommendations: [], primaryRecommendation: null, hasPersonalizedData: false },
  };

  it('CASE A — Activities on 5 distinct Vietnam dates within 7 days -> studyDaysLast7 = 5', () => {
    const dates = [
      '2026-08-08T10:00:00+07:00', // Today
      '2026-08-07T10:00:00+07:00', // Yesterday
      '2026-08-06T10:00:00+07:00', // 2 days ago
      '2026-08-05T10:00:00+07:00', // 3 days ago
      '2026-08-04T10:00:00+07:00', // 4 days ago
    ];

    const data: RawStudentProgressData = {
      ...emptyRawData,
      quizAttempts: dates.map((d) => ({
        content_type: 'grammar',
        score: 80,
        correct_count: 8,
        total_count: 10,
        created_at: d,
      })),
    };

    const res = summarizeStudentProgress(data, mockNow);
    expect(res.studyDaysLast7).toBe(5);
  });

  it('CASE B — 20 vocabulary reviews + 2 quizzes on SAME Vietnam day -> studyDaysLast7 = 1', () => {
    const sameDay = '2026-08-08T09:00:00+07:00';
    const vocabReviews = Array.from({ length: 20 }, () => ({ last_reviewed_at: sameDay }));
    const quizAttempts = [
      { content_type: 'grammar', score: 80, correct_count: 8, total_count: 10, created_at: sameDay },
      { content_type: 'listening', score: 90, correct_count: 9, total_count: 10, created_at: sameDay },
    ];

    const data: RawStudentProgressData = {
      ...emptyRawData,
      vocabularyReviews: vocabReviews,
      quizAttempts,
    };

    const res = summarizeStudentProgress(data, mockNow);
    expect(res.studyDaysLast7).toBe(1);
    expect(res.vocabularyItemsReviewedLast7).toBe(20);
    expect(res.quizAttemptsLast7).toBe(2);
  });

  it('CASE C — Question attempts = 87 rows -> questionAttemptsLast7 = 87', () => {
    const sameDay = '2026-08-08T09:00:00+07:00';
    const qAttempts = Array.from({ length: 87 }, (_, i) => ({
      question_key: `q_${i}`,
      content_type: 'grammar',
      is_correct: i % 2 === 0,
      created_at: sameDay,
    }));

    const data: RawStudentProgressData = {
      ...emptyRawData,
      questionAttempts: qAttempts,
    };

    const res = summarizeStudentProgress(data, mockNow);
    expect(res.questionAttemptsLast7).toBe(87);
  });

  it('CASE D — Mastery input insufficient (<5 unique questions) -> currentMasteryPercent = null', () => {
    const insufficientAnalysis: LearningAnalysis = {
      ...mockAnalysis,
      overallMasteryPercent: null,
      uniqueQuestions: 3,
    };

    const data: RawStudentProgressData = {
      ...emptyRawData,
      analysis: insufficientAnalysis,
    };

    const res = summarizeStudentProgress(data, mockNow);
    expect(res.currentMasteryPercent).toBeNull();
    expect(res.uniqueQuestionsAnalyzed).toBe(3);
  });

  it('CASE E — Analysis mastery = 71% -> Admin summary = 71%', () => {
    const res = summarizeStudentProgress(emptyRawData, mockNow);
    expect(res.currentMasteryPercent).toBe(71);
  });

  it('CASE F — 6 unresolved questions -> unresolvedMistakes = 6', () => {
    const qAttempts = Array.from({ length: 6 }, (_, i) => ({
      question_key: `wrong_q_${i}`,
      content_type: 'grammar',
      is_correct: false,
      created_at: '2026-08-08T08:00:00+07:00',
    }));

    const data: RawStudentProgressData = {
      ...emptyRawData,
      questionAttempts: qAttempts,
    };

    const res = summarizeStudentProgress(data, mockNow);
    expect(res.unresolvedMistakes).toBe(6);
  });

  it('CASE G — No activity -> studyDaysLast7 = 0, lastActivityAt = null, activitySignal = no_data', () => {
    const res = summarizeStudentProgress(emptyRawData, mockNow);
    expect(res.studyDaysLast7).toBe(0);
    expect(res.lastActivityAt).toBeNull();
    expect(res.activitySignal).toBe('no_data');
    expect(res.activitySignalText).toBe('Chưa có dữ liệu học tập');
  });

  it('CASE H — Activity shortly after midnight Vietnam time -> correct Vietnam calendar day', () => {
    // 00:05 AM Vietnam time on 2026-08-08 (which is 17:05 UTC on 2026-08-07)
    const midnightAfterISO = '2026-08-07T17:05:00.000Z';
    const dateKey = getVietnamDateKey(midnightAfterISO);
    expect(dateKey).toBe('2026-08-08');
  });
});
