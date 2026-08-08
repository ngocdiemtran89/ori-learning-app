import { describe, it, expect } from 'vitest';
import {
  analyzeLearningPerformance,
  QuestionAttemptForAnalysis,
} from './weaknessAnalysis';

describe('Phase 2.4 — Learning Weakness Analysis Engine', () => {
  it('CASE A: Question A wrong, wrong, correct & Question B correct -> latest mastery = 100%, uniqueQuestions = 2, totalAttempts = 4, hasEnoughData = false', () => {
    const attempts: QuestionAttemptForAnalysis[] = [
      { question_key: 'qA', content_type: 'grammar', is_correct: false, created_at: '2026-08-08T01:00:00Z' },
      { question_key: 'qA', content_type: 'grammar', is_correct: false, created_at: '2026-08-08T02:00:00Z' },
      { question_key: 'qA', content_type: 'grammar', is_correct: true, created_at: '2026-08-08T03:00:00Z' },
      { question_key: 'qB', content_type: 'grammar', is_correct: true, created_at: '2026-08-08T01:30:00Z' },
    ];

    const result = analyzeLearningPerformance(attempts);

    expect(result.uniqueQuestions).toBe(2);
    expect(result.totalAttempts).toBe(4);
    expect(result.hasEnoughData).toBe(false);
    expect(result.overallMasteryPercent).toBeNull();
  });

  it('CASE B: 10 unique questions (4 latest correct, 6 latest incorrect) -> mastery = 40%, status = focus, confidence = high', () => {
    const attempts: QuestionAttemptForAnalysis[] = [];
    for (let i = 1; i <= 4; i++) {
      attempts.push({
        question_key: `q${i}`,
        content_type: 'grammar',
        is_correct: true,
        created_at: `2026-08-08T0${i}:00:00Z`,
      });
    }
    for (let i = 5; i <= 10; i++) {
      attempts.push({
        question_key: `q${i}`,
        content_type: 'grammar',
        is_correct: false,
        created_at: `2026-08-08T0${i < 10 ? '0' + i : i}:00:00Z`,
      });
    }

    const result = analyzeLearningPerformance(attempts);

    expect(result.uniqueQuestions).toBe(10);
    expect(result.hasEnoughData).toBe(true);
    expect(result.overallMasteryPercent).toBe(40);

    const grammarModule = result.modules.find((m) => m.key === 'grammar');
    expect(grammarModule?.masteryPercent).toBe(40);
    expect(grammarModule?.status).toBe('focus');
    expect(grammarModule?.confidence).toBe('high');
  });

  it('CASE C: 5 unique questions (3 correct) -> 60%, status = improving, confidence = medium', () => {
    const attempts: QuestionAttemptForAnalysis[] = [
      { question_key: 'q1', content_type: 'listening', is_correct: true, created_at: '2026-08-08T01:00:00Z' },
      { question_key: 'q2', content_type: 'listening', is_correct: true, created_at: '2026-08-08T02:00:00Z' },
      { question_key: 'q3', content_type: 'listening', is_correct: true, created_at: '2026-08-08T03:00:00Z' },
      { question_key: 'q4', content_type: 'listening', is_correct: false, created_at: '2026-08-08T04:00:00Z' },
      { question_key: 'q5', content_type: 'listening', is_correct: false, created_at: '2026-08-08T05:00:00Z' },
    ];

    const result = analyzeLearningPerformance(attempts);

    expect(result.uniqueQuestions).toBe(5);
    expect(result.overallMasteryPercent).toBe(60);

    const listeningModule = result.modules.find((m) => m.key === 'listening');
    expect(listeningModule?.status).toBe('improving');
    expect(listeningModule?.confidence).toBe('medium');
  });

  it('CASE D: 10 unique questions (8 correct) -> 80%, status = strong, confidence = high', () => {
    const attempts: QuestionAttemptForAnalysis[] = [];
    for (let i = 1; i <= 8; i++) {
      attempts.push({ question_key: `q${i}`, content_type: 'reading', is_correct: true, created_at: '2026-08-08T01:00:00Z' });
    }
    for (let i = 9; i <= 10; i++) {
      attempts.push({ question_key: `q${i}`, content_type: 'reading', is_correct: false, created_at: '2026-08-08T01:00:00Z' });
    }

    const result = analyzeLearningPerformance(attempts);

    expect(result.overallMasteryPercent).toBe(80);
    const readingModule = result.modules.find((m) => m.key === 'reading');
    expect(readingModule?.status).toBe('strong');
    expect(readingModule?.confidence).toBe('high');
  });

  it('CASE E: Only 3 unique questions (all wrong) -> status = insufficient, NOT focus', () => {
    const attempts: QuestionAttemptForAnalysis[] = [
      { question_key: 'q1', content_type: 'grammar', is_correct: false, created_at: '2026-08-08T01:00:00Z' },
      { question_key: 'q2', content_type: 'grammar', is_correct: false, created_at: '2026-08-08T02:00:00Z' },
      { question_key: 'q3', content_type: 'grammar', is_correct: false, created_at: '2026-08-08T03:00:00Z' },
    ];

    const result = analyzeLearningPerformance(attempts);

    expect(result.hasEnoughData).toBe(false);
    expect(result.overallMasteryPercent).toBeNull();
    const grammarModule = result.modules.find((m) => m.key === 'grammar');
    expect(grammarModule?.status).toBe('insufficient');
    expect(grammarModule?.confidence).toBe('low');
  });

  it('CASE F: Same question attempted 10 times -> uniqueQuestionCount = 1', () => {
    const attempts: QuestionAttemptForAnalysis[] = [];
    for (let i = 1; i <= 10; i++) {
      attempts.push({ question_key: 'qRepeated', content_type: 'grammar', is_correct: i % 2 === 0, created_at: `2026-08-08T0${i}:00:00Z` });
    }

    const result = analyzeLearningPerformance(attempts);

    expect(result.uniqueQuestions).toBe(1);
    expect(result.totalAttempts).toBe(10);
  });

  it('CASE G: Question A (wrong -> correct -> wrong) -> latest is wrong, unresolvedCount = 1', () => {
    const attempts: QuestionAttemptForAnalysis[] = [
      { question_key: 'qA', content_type: 'grammar', is_correct: false, created_at: '2026-08-08T01:00:00Z' },
      { question_key: 'qA', content_type: 'grammar', is_correct: true, created_at: '2026-08-08T02:00:00Z' },
      { question_key: 'qA', content_type: 'grammar', is_correct: false, created_at: '2026-08-08T03:00:00Z' },
    ];

    const result = analyzeLearningPerformance(attempts);

    const grammarModule = result.modules.find((m) => m.key === 'grammar');
    expect(grammarModule?.correctLatestCount).toBe(0);
    expect(grammarModule?.unresolvedCount).toBe(1);
  });

  it('CASE H: Grouping Part 5 (10 q, 40%) vs Part 7 (10 q, 90%) -> Part 5 appears before Part 7 in focus', () => {
    const attempts: QuestionAttemptForAnalysis[] = [];
    // Part 5: 4 correct, 6 wrong
    for (let i = 1; i <= 4; i++) {
      attempts.push({ question_key: `qP5_${i}`, content_type: 'reading', toeic_part: 'part5', is_correct: true, created_at: '2026-08-08T01:00:00Z' });
    }
    for (let i = 5; i <= 10; i++) {
      attempts.push({ question_key: `qP5_${i}`, content_type: 'reading', toeic_part: 'part5', is_correct: false, created_at: '2026-08-08T01:00:00Z' });
    }
    // Part 7: 9 correct, 1 wrong
    for (let i = 1; i <= 9; i++) {
      attempts.push({ question_key: `qP7_${i}`, content_type: 'reading', toeic_part: 'part7', is_correct: true, created_at: '2026-08-08T01:00:00Z' });
    }
    attempts.push({ question_key: 'qP7_10', content_type: 'reading', toeic_part: 'part7', is_correct: false, created_at: '2026-08-08T01:00:00Z' });

    const result = analyzeLearningPerformance(attempts);

    expect(result.focusAreas.length).toBeGreaterThan(0);
    expect(result.focusAreas[0].key).toBe('part5');
    expect(result.focusAreas[0].masteryPercent).toBe(40);
  });

  it('CASE I: skill_tag null -> included in module analysis, NOT included as fake skill', () => {
    const attempts: QuestionAttemptForAnalysis[] = [
      { question_key: 'q1', content_type: 'grammar', skill_tag: null, is_correct: true, created_at: '2026-08-08T01:00:00Z' },
    ];

    const result = analyzeLearningPerformance(attempts);

    expect(result.modules.length).toBe(1);
    expect(result.skills.length).toBe(0);
  });

  it('CASE J: No attempts -> hasEnoughData = false, overallMasteryPercent = null', () => {
    const result = analyzeLearningPerformance([]);

    expect(result.hasEnoughData).toBe(false);
    expect(result.overallMasteryPercent).toBeNull();
    expect(result.totalAttempts).toBe(0);
    expect(result.uniqueQuestions).toBe(0);
  });

  it('CASE K: Focus areas max 3', () => {
    const attempts: QuestionAttemptForAnalysis[] = [];
    const skillsList = ['Present Simple', 'Past Simple', 'Relative Clauses', 'Conditionals'];

    for (const skill of skillsList) {
      for (let i = 1; i <= 5; i++) {
        attempts.push({
          question_key: `${skill}_${i}`,
          content_type: 'grammar',
          skill_tag: skill,
          is_correct: i <= 2, // 40% mastery for all
          created_at: '2026-08-08T01:00:00Z',
        });
      }
    }

    const result = analyzeLearningPerformance(attempts);

    expect(result.focusAreas.length).toBeLessThanOrEqual(3);
  });

  it('CASE L: Broad weak module & specific weak skill exist -> specific actionable skill preferred', () => {
    const attempts: QuestionAttemptForAnalysis[] = [];
    for (let i = 1; i <= 5; i++) {
      attempts.push({
        question_key: `skill_q${i}`,
        content_type: 'grammar',
        skill_tag: 'Present Simple',
        is_correct: i <= 1, // 20%
        created_at: '2026-08-08T01:00:00Z',
      });
    }

    const result = analyzeLearningPerformance(attempts);

    expect(result.focusAreas.length).toBeGreaterThan(0);
    expect(result.focusAreas[0].dimension).toBe('skill');
    expect(result.focusAreas[0].key).toBe('Present Simple');
  });

  it('CASE M: Specific skill vs TOEIC Part preference -> Tier 1 Skill preferred over Tier 2 TOEIC Part even if Part mastery is slightly lower', () => {
    const attempts: QuestionAttemptForAnalysis[] = [];
    // Skill: 45% (5 questions)
    for (let i = 1; i <= 5; i++) {
      attempts.push({ question_key: `s_${i}`, content_type: 'grammar', skill_tag: 'Present Simple', is_correct: i <= 2, created_at: '2026-08-08T01:00:00Z' });
    }
    // TOEIC Part: 40% (5 questions)
    for (let i = 1; i <= 5; i++) {
      attempts.push({ question_key: `p_${i}`, content_type: 'reading', toeic_part: 'part5', is_correct: i <= 2, created_at: '2026-08-08T01:00:00Z' });
    }

    const result = analyzeLearningPerformance(attempts);

    expect(result.focusAreas.length).toBeGreaterThanOrEqual(2);
    expect(result.focusAreas[0].dimension).toBe('skill');
    expect(result.focusAreas[1].dimension).toBe('toeic_part');
  });

  it('CASE N: Only TOEIC Part and Topic eligible -> Tier 2 TOEIC Part preferred before Tier 3 Topic', () => {
    const attempts: QuestionAttemptForAnalysis[] = [];
    for (let i = 1; i <= 5; i++) {
      attempts.push({ question_key: `p_${i}`, content_type: 'reading', toeic_part: 'part5', topic: 'Office', is_correct: i <= 2, created_at: '2026-08-08T01:00:00Z' });
    }

    const result = analyzeLearningPerformance(attempts);

    expect(result.focusAreas.length).toBeGreaterThan(0);
    expect(result.focusAreas[0].dimension).toBe('toeic_part');
  });

  it('CASE O: No specific categories eligible, module eligible -> Tier 4 Module fallback', () => {
    const attempts: QuestionAttemptForAnalysis[] = [];
    for (let i = 1; i <= 5; i++) {
      attempts.push({ question_key: `m_${i}`, content_type: 'grammar', is_correct: false, created_at: '2026-08-08T01:00:00Z' });
    }

    const result = analyzeLearningPerformance(attempts);

    expect(result.focusAreas.length).toBe(1);
    expect(result.focusAreas[0].dimension).toBe('module');
  });
});
