/**
 * Pure Daily Study Plan Engine for ORI Learning (Phase 2.3B / 2.5)
 * Deterministic, Zero-AI, derives daily study plan from student learning history & recommendations.
 */

import type { LearningRecommendation } from './recommendationEngine';

export type DailyPlanItemType =
  | 'vocabulary_review'
  | 'mistake_review'
  | 'continue_lesson'
  | 'grammar_lesson'
  | 'listening_lesson'
  | 'reading_lesson'
  | 'grammar'
  | 'listening'
  | 'reading'
  | 'general_practice';

export interface DailyPlanItem {
  id: string;
  type: DailyPlanItemType;
  title: string;
  description?: string;
  route: string;
  estimatedMinutes: number;
  priority: number;
  completed: boolean;
  currentCount?: number;
  targetCount?: number;
  sourceLessonId?: string;
}

export interface DailyStudyPlan {
  items: DailyPlanItem[];
  totalEstimatedMinutes: number;
  completedItems: number;
  totalItems: number;
}

export interface UnresolvedMistakeSummary {
  totalUnresolved: number;
  byCategory: Record<string, number>;
  topCategory?: string;
}

export interface UserProgressLesson {
  content_type: 'grammar' | 'listening' | 'reading';
  content_id: string;
  title: string;
  slug: string;
  status: 'not_started' | 'in_progress' | 'completed';
  last_seen_at?: string | null;
  completed_at?: string | null;
}

export interface PublishedLessonInfo {
  id: string;
  kind: 'grammar' | 'listening' | 'reading';
  title: string;
  slug: string;
  level: string;
  sort_order: number;
  toeic_part?: string | null;
}

export interface DailyPlanInput {
  vocabularyDueCount: number;
  vocabularyReviewedTodayCount: number;
  unresolvedMistakeSummary: UnresolvedMistakeSummary;
  inProgressLesson?: UserProgressLesson | null;
  recentActivityTypes?: string[]; // e.g. ['listening', 'grammar']
  availableLessons?: PublishedLessonInfo[];
  completedLessonIdsToday?: Set<string>;
  studentLevel?: string;
  primaryRecommendation?: LearningRecommendation | null;
}

/**
 * Check if a lesson level is allowed for a student level.
 * Rules:
 * - Foundation student: only 'foundation' (never intermediate or advanced).
 * - Intermediate student: 'intermediate' and 'foundation' (if fallback needed), but NEVER 'advanced'.
 * - Advanced student: 'advanced', 'intermediate', 'foundation'.
 */
export function isLessonAllowedForStudent(studentLevel: string, lessonLevel: string): boolean {
  const sLevel = (studentLevel || 'foundation').toLowerCase().trim();
  const lLevel = (lessonLevel || 'foundation').toLowerCase().trim();

  const levelRank: Record<string, number> = {
    foundation: 1,
    intermediate: 2,
    advanced: 3,
  };

  const studentRank = levelRank[sLevel] || 1;
  const lessonRank = levelRank[lLevel] || 1;

  // Never allow content higher than student rank!
  return lessonRank <= studentRank;
}

/**
 * Calculate unresolved mistakes summary from question_attempts array
 */
export function calculateUnresolvedMistakes(
  questionAttempts: Array<{
    question_key: string;
    content_type: string;
    is_correct: boolean;
    created_at: string;
  }>
): UnresolvedMistakeSummary {
  if (!questionAttempts || questionAttempts.length === 0) {
    return { totalUnresolved: 0, byCategory: {} };
  }

  // Sort chronological ascending
  const sorted = [...questionAttempts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const map = new Map<string, {
    wrong_count: number;
    latest_is_correct: boolean;
    content_type: string;
  }>();

  for (const row of sorted) {
    const existing = map.get(row.question_key);
    let wrongCount = existing ? existing.wrong_count : 0;
    if (!row.is_correct) {
      wrongCount++;
    }
    map.set(row.question_key, {
      wrong_count: wrongCount,
      latest_is_correct: row.is_correct,
      content_type: row.content_type,
    });
  }

  const byCategory: Record<string, number> = {};
  let totalUnresolved = 0;

  for (const entry of map.values()) {
    if (entry.wrong_count > 0 && !entry.latest_is_correct) {
      totalUnresolved++;
      const cat = entry.content_type || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
  }

  let topCategory: string | undefined = undefined;
  let maxCatCount = 0;
  for (const [cat, cnt] of Object.entries(byCategory)) {
    if (cnt > maxCatCount) {
      maxCatCount = cnt;
      topCategory = cat;
    }
  }

  return { totalUnresolved, byCategory, topCategory };
}

/**
 * Build deterministic daily study plan (Max 4 achievable tasks, Hard Cap <= 30 mins)
 */
export function buildDailyStudyPlan(input: DailyPlanInput): DailyStudyPlan {
  const items: DailyPlanItem[] = [];
  const maxItems = 4;
  const completedToday = input.completedLessonIdsToday || new Set<string>();
  const level = (input.studentLevel || 'foundation').toLowerCase();

  // RULE 1 — VOCABULARY REVIEW
  if (input.vocabularyDueCount > 0 || input.vocabularyReviewedTodayCount > 0) {
    const isCompleted = input.vocabularyDueCount === 0 && input.vocabularyReviewedTodayCount > 0;
    const targetCount = input.vocabularyDueCount > 0
      ? Math.min(input.vocabularyDueCount, 20)
      : input.vocabularyReviewedTodayCount;
    const estimatedMinutes = Math.min(8, Math.max(2, Math.ceil(targetCount / 2.5)));

    const title = isCompleted
      ? `Đã ôn ${targetCount} từ vựng hôm nay`
      : `Ôn ${targetCount} từ vựng đến hạn`;

    const description = isCompleted
      ? 'Bạn đã hoàn thành các từ vựng đến hạn theo chu kỳ SRS'
      : 'Ôn tập từ vựng theo chu kỳ lặp lại ngắt quãng (SRS)';

    items.push({
      id: 'plan-vocab',
      type: 'vocabulary_review',
      title,
      description,
      route: '/vocabulary/review-today',
      estimatedMinutes,
      priority: 1,
      completed: isCompleted,
      currentCount: input.vocabularyReviewedTodayCount,
      targetCount,
    });
  }

  // RULE 2 — WRONG ANSWER REVIEW
  if (input.unresolvedMistakeSummary.totalUnresolved > 0) {
    const targetCount = Math.min(input.unresolvedMistakeSummary.totalUnresolved, 5);
    const estimatedMinutes = Math.min(10, targetCount * 2);
    const topCat = input.unresolvedMistakeSummary.topCategory;
    const topCatLabel = topCat ? topCat.toUpperCase() : 'TỔNG HỢP';
    const description = `${topCatLabel} • ${input.unresolvedMistakeSummary.totalUnresolved} lỗi chưa khắc phục`;

    items.push({
      id: 'plan-mistakes',
      type: 'mistake_review',
      title: `Khắc phục ${targetCount} lỗi sai`,
      description,
      route: '/mistakes',
      estimatedMinutes,
      priority: 2,
      completed: input.unresolvedMistakeSummary.totalUnresolved === 0,
      currentCount: 0,
      targetCount,
    });
  }

  // RULE 3 — CONTINUE LEARNING
  if (input.inProgressLesson && items.length < maxItems) {
    const l = input.inProgressLesson;
    const route = `/${l.content_type}/${l.slug || l.content_id}`;
    const isCompleted = l.status === 'completed' || completedToday.has(l.content_id);

    items.push({
      id: `plan-continue-${l.content_id}`,
      type: 'continue_lesson',
      title: `Học tiếp: ${l.title}`,
      description: 'Tiếp tục bài học đang hoàn thiện dở dang',
      route,
      estimatedMinutes: 8,
      priority: 3,
      completed: isCompleted,
      sourceLessonId: l.content_id,
    });
  }

  // RULE 4 — PERSONALIZED PRACTICE / BALANCED PRACTICE
  if (items.length < maxItems && (input.availableLessons || input.primaryRecommendation)) {
    const currentTotal = items.filter((i) => !i.completed).reduce((s, i) => s + i.estimatedMinutes, 0);
    const remainingAvailable = 30 - currentTotal;

    let addedPersonalized = false;

    // Try personalized recommendation first if valid and not a duplicate
    if (input.primaryRecommendation && remainingAvailable >= 5) {
      const rec = input.primaryRecommendation;
      const recRoute = rec.route.toLowerCase();
      const recLessonId = rec.sourceLessonId || '';

      const isDuplicate = items.some((it) => {
        const itRoute = it.route.toLowerCase();
        const matchesRoute = itRoute === recRoute;
        const matchesLessonId = recLessonId && (it.sourceLessonId === recLessonId || it.id.includes(recLessonId));
        return matchesRoute || matchesLessonId;
      });

      if (!isDuplicate) {
        let isCompleted = false;
        if (recLessonId) {
          isCompleted = completedToday.has(recLessonId);
        } else if (rec.route === '/mistakes') {
          isCompleted = input.unresolvedMistakeSummary.totalUnresolved === 0;
        } else if (rec.type === 'vocabulary_review') {
          isCompleted = input.vocabularyDueCount === 0 && input.vocabularyReviewedTodayCount > 0;
        }

        items.push({
          id: `plan-personalized-${recLessonId || rec.id}`,
          type: rec.type,
          title: `Gợi ý: ${rec.title}`,
          description: rec.description,
          route: rec.route,
          estimatedMinutes: Math.min(rec.estimatedMinutes, remainingAvailable),
          priority: 4,
          completed: isCompleted,
          sourceLessonId: recLessonId || undefined,
        });
        addedPersonalized = true;
      }
    }

    // Fallback to standard balanced practice if no personalized task was added
    if (!addedPersonalized && input.availableLessons && input.availableLessons.length > 0) {
      const kinds: Array<'grammar' | 'listening' | 'reading'> = ['grammar', 'listening', 'reading'];
      const usedLessonIds = new Set<string>();

      items.forEach((it) => {
        if (it.type === 'continue_lesson' && input.inProgressLesson) {
          usedLessonIds.add(input.inProgressLesson.content_id);
        }
      });

      const recent = input.recentActivityTypes || [];
      kinds.sort((a, b) => {
        const idxA = recent.indexOf(a);
        const idxB = recent.indexOf(b);
        const posA = idxA === -1 ? 999 : idxA;
        const posB = idxB === -1 ? 999 : idxB;
        return posB - posA;
      });

      for (const kind of kinds) {
        if (items.length >= maxItems) break;

        const loopTotal = items.filter((i) => !i.completed).reduce((s, i) => s + i.estimatedMinutes, 0);
        if (loopTotal >= 30) break;

        const loopCap = 30 - loopTotal;
        if (loopCap < 5) break;

        const matchingLessons = input.availableLessons.filter((l) => {
          const matchesKind = l.kind === kind;
          const isAllowed = isLessonAllowedForStudent(level, l.level);
          return matchesKind && isAllowed && !usedLessonIds.has(l.id);
        });

        matchingLessons.sort((a, b) => {
          const aExact = (a.level || 'foundation').toLowerCase() === level ? 0 : 1;
          const bExact = (b.level || 'foundation').toLowerCase() === level ? 0 : 1;
          if (aExact !== bExact) return aExact - bExact;
          return a.sort_order - b.sort_order;
        });

        const selected = matchingLessons[0];

        if (selected) {
          usedLessonIds.add(selected.id);

          const isCompleted = completedToday.has(selected.id);
          const typeTitle = kind === 'grammar' ? 'Ngữ pháp' : kind === 'listening' ? 'Luyện nghe' : 'Luyện đọc';
          const estMin = Math.min(7, loopCap);

          items.push({
            id: `plan-practice-${selected.id}`,
            type: kind,
            title: `Luyện tập ${typeTitle}: ${selected.title}`,
            description: `Rèn luyện kỹ năng ${typeTitle} theo trình độ ${level.toUpperCase()}`,
            route: `/${kind}/${selected.slug || selected.id}`,
            estimatedMinutes: estMin,
            priority: 4,
            completed: isCompleted,
          });
        }
      }
    }
  }

  // Summary Metrics — Ensure totalEstimatedMinutes NEVER exceeds 30!
  const completedItems = items.filter((i) => i.completed).length;
  const totalEstimatedMinutes = Math.min(
    30,
    items.filter((i) => !i.completed).reduce((sum, i) => sum + i.estimatedMinutes, 0)
  );

  return {
    items,
    totalEstimatedMinutes,
    completedItems,
    totalItems: items.length,
  };
}
