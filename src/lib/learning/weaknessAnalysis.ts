/**
 * Pure Learning Weakness Analysis Engine for ORI Learning (Phase 2.4)
 * Deterministic, Zero-AI, calculates learning mastery & weakness from question_attempts.
 */

export type AnalysisDimension = 'module' | 'toeic_part' | 'skill' | 'topic';
export type AnalysisStatus = 'insufficient' | 'focus' | 'improving' | 'strong';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface PerformanceStat {
  dimension: AnalysisDimension;
  key: string;
  label: string;

  uniqueQuestionCount: number;
  totalAttemptCount: number;

  correctLatestCount: number;
  unresolvedCount: number;

  masteryPercent: number;

  status: AnalysisStatus;
  confidence: ConfidenceLevel;
}

export interface LearningAnalysis {
  overallMasteryPercent: number | null;

  totalAttempts: number;
  uniqueQuestions: number;

  modules: PerformanceStat[];
  toeicParts: PerformanceStat[];
  skills: PerformanceStat[];
  topics: PerformanceStat[];

  focusAreas: PerformanceStat[];

  hasEnoughData: boolean;
  analysisTruncated?: boolean;
}

export interface QuestionAttemptForAnalysis {
  question_key: string;
  content_type: string;
  is_correct: boolean;
  skill_tag?: string | null;
  toeic_part?: string | null;
  topic?: string | null;
  created_at: string;
}

/**
 * Format raw keys to student-friendly Vietnamese labels
 */
export function formatStatLabel(dimension: AnalysisDimension, rawKey: string): string {
  if (!rawKey) return 'Khác';

  if (dimension === 'module') {
    const keyLower = rawKey.toLowerCase();
    if (keyLower === 'grammar') return 'Ngữ pháp';
    if (keyLower === 'listening') return 'Luyện nghe';
    if (keyLower === 'reading') return 'Luyện đọc';
    if (keyLower === 'vocabulary' || keyLower === 'vocab') return 'Từ vựng';
    return rawKey;
  }

  if (dimension === 'toeic_part') {
    const partNum = rawKey.toLowerCase().replace('part', '').trim();
    if (partNum) return `TOEIC Part ${partNum}`;
    return rawKey;
  }

  return rawKey;
}

/**
 * Analyze student question_attempts to produce deterministic weakness analysis
 */
export function analyzeLearningPerformance(
  attempts: QuestionAttemptForAnalysis[],
  options: { isTruncated?: boolean } = {}
): LearningAnalysis {
  if (!attempts || attempts.length === 0) {
    return {
      overallMasteryPercent: null,
      totalAttempts: 0,
      uniqueQuestions: 0,
      modules: [],
      toeicParts: [],
      skills: [],
      topics: [],
      focusAreas: [],
      hasEnoughData: false,
      analysisTruncated: false,
    };
  }

  const totalAttempts = attempts.length;

  // 1. Sort chronological ascending to evaluate latest state per unique question_key
  const sorted = [...attempts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  interface QuestionState {
    question_key: string;
    content_type: string;
    latest_is_correct: boolean;
    has_wrong: boolean;
    skill_tag?: string | null;
    toeic_part?: string | null;
    topic?: string | null;
    attempt_count: number;
  }

  const questionMap = new Map<string, QuestionState>();

  for (const row of sorted) {
    const existing = questionMap.get(row.question_key);
    const hasWrong = existing ? (existing.has_wrong || !row.is_correct) : !row.is_correct;
    const attemptCount = existing ? existing.attempt_count + 1 : 1;

    questionMap.set(row.question_key, {
      question_key: row.question_key,
      content_type: row.content_type,
      latest_is_correct: row.is_correct,
      has_wrong: hasWrong,
      skill_tag: row.skill_tag || existing?.skill_tag || null,
      toeic_part: row.toeic_part || existing?.toeic_part || null,
      topic: row.topic || existing?.topic || null,
      attempt_count: attemptCount,
    });
  }

  const uniqueQuestionsList = Array.from(questionMap.values());
  const uniqueQuestions = uniqueQuestionsList.length;

  // 2. Overall Mastery calculation based strictly on latest attempt per unique question
  let overallCorrect = 0;
  for (const q of uniqueQuestionsList) {
    if (q.latest_is_correct) {
      overallCorrect++;
    }
  }

  const hasEnoughData = uniqueQuestions >= 5;
  const overallMasteryPercent = hasEnoughData
    ? Math.round((overallCorrect / uniqueQuestions) * 100)
    : null;

  // Helper to build PerformanceStat for a grouping dimension
  function buildStatsForDimension(
    dimension: AnalysisDimension,
    getKey: (q: QuestionState) => string | null | undefined
  ): PerformanceStat[] {
    const groups = new Map<
      string,
      {
        uniqueQuestions: number;
        totalAttempts: number;
        correctLatest: number;
        unresolved: number;
      }
    >();

    for (const q of uniqueQuestionsList) {
      const rawKey = getKey(q);
      if (!rawKey || rawKey.trim() === '') continue;
      const key = rawKey.trim();

      const existing = groups.get(key) || {
        uniqueQuestions: 0,
        totalAttempts: 0,
        correctLatest: 0,
        unresolved: 0,
      };

      existing.uniqueQuestions += 1;
      existing.totalAttempts += q.attempt_count;
      if (q.latest_is_correct) {
        existing.correctLatest += 1;
      } else if (q.has_wrong) {
        existing.unresolved += 1;
      }

      groups.set(key, existing);
    }

    const result: PerformanceStat[] = [];

    for (const [key, g] of groups.entries()) {
      const uCount = g.uniqueQuestions;
      const masteryPercent = Math.round((g.correctLatest / uCount) * 100);

      let confidence: ConfidenceLevel = 'low';
      if (uCount >= 10) {
        confidence = 'high';
      } else if (uCount >= 5) {
        confidence = 'medium';
      }

      let status: AnalysisStatus = 'insufficient';
      if (uCount >= 5) {
        if (masteryPercent < 60) {
          status = 'focus';
        } else if (masteryPercent < 80) {
          status = 'improving';
        } else {
          status = 'strong';
        }
      }

      result.push({
        dimension,
        key,
        label: formatStatLabel(dimension, key),
        uniqueQuestionCount: uCount,
        totalAttemptCount: g.totalAttempts,
        correctLatestCount: g.correctLatest,
        unresolvedCount: g.unresolved,
        masteryPercent,
        status,
        confidence,
      });
    }

    // Sort by sort_order / uniqueQuestionCount descending
    result.sort((a, b) => b.uniqueQuestionCount - a.uniqueQuestionCount);
    return result;
  }

  const modules = buildStatsForDimension('module', (q) => q.content_type);
  const toeicParts = buildStatsForDimension('toeic_part', (q) => q.toeic_part);
  const skills = buildStatsForDimension('skill', (q) => q.skill_tag);
  const topics = buildStatsForDimension('topic', (q) => q.topic);

  // 3. Select Actionable Focus Areas (Max 3)
  // Preference order: specific categories first (skill -> toeic_part -> topic), module as fallback
  const candidatePool: PerformanceStat[] = [];

  // Add eligible skills
  skills.forEach((s) => {
    if (s.uniqueQuestionCount >= 5 && (s.status === 'focus' || s.status === 'improving')) {
      candidatePool.push(s);
    }
  });

  // Add eligible TOEIC Parts
  toeicParts.forEach((p) => {
    if (p.uniqueQuestionCount >= 5 && (p.status === 'focus' || p.status === 'improving')) {
      candidatePool.push(p);
    }
  });

  // Add eligible Topics
  topics.forEach((t) => {
    if (t.uniqueQuestionCount >= 5 && (t.status === 'focus' || t.status === 'improving')) {
      candidatePool.push(t);
    }
  });

  // If candidate pool has fewer than 3, add eligible modules as fallback
  if (candidatePool.length < 3) {
    modules.forEach((m) => {
      if (m.uniqueQuestionCount >= 5 && (m.status === 'focus' || m.status === 'improving')) {
        if (!candidatePool.some((c) => c.key.toLowerCase() === m.key.toLowerCase())) {
          candidatePool.push(m);
        }
      }
    });
  }

  // Sort candidate focus areas: lowest masteryPercent first, then highest unresolvedCount, then uniqueQuestionCount
  candidatePool.sort((a, b) => {
    if (a.masteryPercent !== b.masteryPercent) {
      return a.masteryPercent - b.masteryPercent;
    }
    if (a.unresolvedCount !== b.unresolvedCount) {
      return b.unresolvedCount - a.unresolvedCount;
    }
    return b.uniqueQuestionCount - a.uniqueQuestionCount;
  });

  // Deduplicate and cap at 3
  const focusAreas: PerformanceStat[] = [];
  const seenKeys = new Set<string>();

  for (const item of candidatePool) {
    const itemKey = `${item.dimension}:${item.key.toLowerCase()}`;
    if (!seenKeys.has(itemKey) && focusAreas.length < 3) {
      seenKeys.add(itemKey);
      focusAreas.push(item);
    }
  }

  return {
    overallMasteryPercent,
    totalAttempts,
    uniqueQuestions,
    modules,
    toeicParts,
    skills,
    topics,
    focusAreas,
    hasEnoughData,
    analysisTruncated: options.isTruncated || false,
  };
}
