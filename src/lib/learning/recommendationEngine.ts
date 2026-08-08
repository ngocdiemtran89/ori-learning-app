/**
 * Pure Recommendation Engine for ORI Learning (Phase 2.5B)
 * Deterministic, Zero-AI, converts learning weakness analysis into personalized study recommendations.
 */

import {
  isLessonAllowedForStudent,
  PublishedLessonInfo,
} from './dailyPlan';
import { LearningAnalysis } from './weaknessAnalysis';

export type RecommendationType =
  | 'grammar_lesson'
  | 'listening_lesson'
  | 'reading_lesson'
  | 'vocabulary_review'
  | 'mistake_review'
  | 'general_practice';

export type RecommendationReason =
  | 'weak_skill'
  | 'weak_toeic_part'
  | 'weak_topic'
  | 'weak_module'
  | 'unresolved_mistakes'
  | 'insufficient_data';

export interface LearningRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  route: string;
  reason: RecommendationReason;

  focusLabel?: string;
  masteryPercent?: number;
  unresolvedCount?: number;

  sourceLessonId?: string;
  sourceLessonSlug?: string;

  estimatedMinutes: number;
  priorityScore: number;
}

export interface LearningRecommendations {
  recommendations: LearningRecommendation[];
  primaryRecommendation: LearningRecommendation | null;
  hasPersonalizedData: boolean;
}

export interface RecommendationInput {
  analysis: LearningAnalysis;
  studentLevel: string;
  publishedGrammarLessons: PublishedLessonInfo[];
  publishedLearningLessons: PublishedLessonInfo[];
  inProgressLessonId?: string | null;
  recentlyCompletedLessonIds?: Set<string>;
}

/**
 * Normalize string for exact & partial matching
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize TOEIC Part string to canonical format e.g. 'part5'
 */
export function normalizeToeicPart(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.toLowerCase().trim();
  const numMatch = clean.match(/part\s*([1-7])/i) || clean.match(/^([1-7])$/);
  if (numMatch) {
    return `part${numMatch[1]}`;
  }
  return null;
}

/**
 * Deterministically select best matching lesson among candidates:
 * 1. Uncompleted lessons preferred over recently completed ones
 * 2. Exact student level match preferred over lower level fallbacks
 * 3. Lowest sort_order ascending
 */
export function selectBestMatchingLesson(
  candidates: PublishedLessonInfo[],
  studentLevel: string,
  recentlyCompletedLessonIds: Set<string> = new Set()
): PublishedLessonInfo | null {
  if (!candidates || candidates.length === 0) return null;

  const level = (studentLevel || 'foundation').toLowerCase();

  const sorted = [...candidates].sort((a, b) => {
    const aRecent = recentlyCompletedLessonIds.has(a.id) ? 1 : 0;
    const bRecent = recentlyCompletedLessonIds.has(b.id) ? 1 : 0;
    if (aRecent !== bRecent) return aRecent - bRecent; // Uncompleted first

    const aExact = (a.level || 'foundation').toLowerCase() === level ? 0 : 1;
    const bExact = (b.level || 'foundation').toLowerCase() === level ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact; // Exact level match first

    return (a.sort_order || 999) - (b.sort_order || 999); // Lowest sort_order first
  });

  return sorted[0] || null;
}

/**
 * Calculate deterministic priority score
 * Formula: Tier Weight (400/300/200/100) + Mastery Deficit (100 - mastery) + Unresolved Bonus (min(count*5, 30)) - Recently Completed Penalty (150)
 */
export function calculatePriorityScore(
  reason: RecommendationReason,
  masteryPercent: number = 50,
  unresolvedCount: number = 0,
  isRecentlyCompleted: boolean = false
): number {
  let tierWeight = 100;
  if (reason === 'weak_skill') tierWeight = 400;
  else if (reason === 'weak_toeic_part') tierWeight = 300;
  else if (reason === 'weak_topic') tierWeight = 200;
  else if (reason === 'unresolved_mistakes') tierWeight = 150;
  else if (reason === 'weak_module') tierWeight = 100;

  const masteryDeficit = Math.max(0, 100 - masteryPercent);
  const unresolvedBonus = Math.min(unresolvedCount * 5, 30);
  const penalty = isRecentlyCompleted ? 150 : 0;

  return tierWeight + masteryDeficit + unresolvedBonus - penalty;
}

/**
 * Build deterministic personalized study recommendations (Max 3)
 */
export function buildLearningRecommendations(input: RecommendationInput): LearningRecommendations {
  const {
    analysis,
    studentLevel,
    publishedGrammarLessons = [],
    publishedLearningLessons = [],
    recentlyCompletedLessonIds = new Set<string>(),
  } = input;

  if (!analysis || !analysis.hasEnoughData || !analysis.focusAreas || analysis.focusAreas.length === 0) {
    return {
      recommendations: [],
      primaryRecommendation: null,
      hasPersonalizedData: false,
    };
  }

  const rawCandidates: LearningRecommendation[] = [];
  const level = (studentLevel || 'foundation').toLowerCase();

  for (const focus of analysis.focusAreas) {
    // A. SKILL MAPPING (GRAMMAR)
    if (focus.dimension === 'skill') {
      const normSkill = normalizeString(focus.key);

      const eligibleGrammar = publishedGrammarLessons.filter((g) =>
        isLessonAllowedForStudent(level, g.level)
      );

      // 1. Exact match on title or slug
      let matched = eligibleGrammar.filter((g) => {
        const normTitle = normalizeString(g.title);
        const normSlug = normalizeString(g.slug);
        return normTitle === normSkill || normSlug === normSkill;
      });

      // 2. Includes match if single unambiguous match
      if (matched.length === 0) {
        const includesMatch = eligibleGrammar.filter((g) => {
          const normTitle = normalizeString(g.title);
          return normTitle.includes(normSkill) || normSkill.includes(normTitle);
        });
        if (includesMatch.length === 1) {
          matched = includesMatch;
        }
      }

      const selected = selectBestMatchingLesson(matched, level, recentlyCompletedLessonIds);

      if (selected) {
        const isRecent = recentlyCompletedLessonIds.has(selected.id);
        const score = calculatePriorityScore('weak_skill', focus.masteryPercent, focus.unresolvedCount, isRecent);

        rawCandidates.push({
          id: `rec-skill-${selected.id}`,
          type: 'grammar_lesson',
          title: `Học lại: ${selected.title}`,
          description: `Bạn đang làm đúng ${focus.masteryPercent}% các câu thuộc kỹ năng ${focus.label}.`,
          route: `/grammar/${selected.slug || selected.id}`,
          reason: 'weak_skill',
          focusLabel: focus.label,
          masteryPercent: focus.masteryPercent,
          unresolvedCount: focus.unresolvedCount,
          sourceLessonId: selected.id,
          sourceLessonSlug: selected.slug,
          estimatedMinutes: 8,
          priorityScore: score,
        });
      } else {
        // Fallback safely to /mistakes if no direct lesson mapped
        const score = calculatePriorityScore('weak_skill', focus.masteryPercent, focus.unresolvedCount, false);
        rawCandidates.push({
          id: `rec-skill-mistakes-${focus.key}`,
          type: 'mistake_review',
          title: `Luyện tập lại kỹ năng: ${focus.label}`,
          description: `Bạn đang làm đúng ${focus.masteryPercent}% các câu thuộc ${focus.label}. Hãy làm lại câu sai trong Sổ lỗi sai.`,
          route: '/mistakes',
          reason: 'weak_skill',
          focusLabel: focus.label,
          masteryPercent: focus.masteryPercent,
          unresolvedCount: focus.unresolvedCount,
          estimatedMinutes: 8,
          priorityScore: score,
        });
      }
    }

    // B. TOEIC PART MAPPING
    else if (focus.dimension === 'toeic_part') {
      const canonicalPart = normalizeToeicPart(focus.key); // e.g. 'part2', 'part5'
      if (canonicalPart) {
        const partNum = parseInt(canonicalPart.replace('part', ''), 10);
        const isListeningPart = partNum >= 1 && partNum <= 4;
        const requiredKind = isListeningPart ? 'listening' : 'reading';

        // Filter by kind, student level allowed, AND explicit toeic_part metadata match!
        const matched = publishedLearningLessons.filter((l) => {
          const matchesKind = l.kind === requiredKind;
          const isAllowed = isLessonAllowedForStudent(level, l.level);
          const normLessonPart = normalizeToeicPart(l.toeic_part || '');
          const matchesPart = normLessonPart === canonicalPart;
          return matchesKind && isAllowed && matchesPart;
        });

        const selected = selectBestMatchingLesson(matched, level, recentlyCompletedLessonIds);

        if (selected) {
          const isRecent = recentlyCompletedLessonIds.has(selected.id);
          const score = calculatePriorityScore('weak_toeic_part', focus.masteryPercent, focus.unresolvedCount, isRecent);
          const typeStr = selected.kind === 'listening' ? 'listening_lesson' : 'reading_lesson';
          const typeLabel = selected.kind === 'listening' ? 'Luyện nghe' : 'Luyện đọc';

          rawCandidates.push({
            id: `rec-part-${selected.id}`,
            type: typeStr as RecommendationType,
            title: `Luyện ${typeLabel} ${focus.label}`,
            description: `${focus.label} hiện đạt ${focus.masteryPercent}% trên ${focus.uniqueQuestionCount} câu khác nhau.`,
            route: `/${selected.kind}/${selected.slug || selected.id}`,
            reason: 'weak_toeic_part',
            focusLabel: focus.label,
            masteryPercent: focus.masteryPercent,
            unresolvedCount: focus.unresolvedCount,
            sourceLessonId: selected.id,
            sourceLessonSlug: selected.slug,
            estimatedMinutes: 7,
            priorityScore: score,
          });
        } else {
          // NO WRONG-PART FALLBACK! Fallback safely to /mistakes without misrepresenting unrelated lessons
          const score = calculatePriorityScore('weak_toeic_part', focus.masteryPercent, focus.unresolvedCount, false);
          rawCandidates.push({
            id: `rec-part-mistakes-${canonicalPart}`,
            type: 'mistake_review',
            title: `Luyện lại ${focus.label}`,
            description: `Hiện chưa có bài học ${focus.label} phù hợp với trình độ của bạn. Hãy xem lại các câu sai trước.`,
            route: '/mistakes',
            reason: 'weak_toeic_part',
            focusLabel: focus.label,
            masteryPercent: focus.masteryPercent,
            unresolvedCount: focus.unresolvedCount,
            estimatedMinutes: 7,
            priorityScore: score,
          });
        }
      }
    }

    // C. TOPIC / VOCABULARY MAPPING
    else if (focus.dimension === 'topic') {
      const score = calculatePriorityScore('weak_topic', focus.masteryPercent, focus.unresolvedCount, false);
      rawCandidates.push({
        id: `rec-topic-${focus.key}`,
        type: 'vocabulary_review',
        title: `Ôn lại từ vựng cần tập trung`,
        description: `Bạn đang cần củng cố từ vựng chủ đề ${focus.label} (hiện đạt ${focus.masteryPercent}%).`,
        route: '/vocabulary/review-today',
        reason: 'weak_topic',
        focusLabel: focus.label,
        masteryPercent: focus.masteryPercent,
        unresolvedCount: focus.unresolvedCount,
        estimatedMinutes: 8,
        priorityScore: score,
      });
    }

    // D. MODULE MAPPING FALLBACK
    else if (focus.dimension === 'module') {
      const modKey = focus.key.toLowerCase();
      let candidateLessons: PublishedLessonInfo[] = [];
      let recType: RecommendationType = 'general_practice';
      let routeKind = 'grammar';

      if (modKey === 'grammar') {
        candidateLessons = publishedGrammarLessons.filter((g) => isLessonAllowedForStudent(level, g.level));
        recType = 'grammar_lesson';
        routeKind = 'grammar';
      } else if (modKey === 'listening') {
        candidateLessons = publishedLearningLessons.filter((l) => l.kind === 'listening' && isLessonAllowedForStudent(level, l.level));
        recType = 'listening_lesson';
        routeKind = 'listening';
      } else if (modKey === 'reading') {
        candidateLessons = publishedLearningLessons.filter((l) => l.kind === 'reading' && isLessonAllowedForStudent(level, l.level));
        recType = 'reading_lesson';
        routeKind = 'reading';
      }

      const selected = selectBestMatchingLesson(candidateLessons, level, recentlyCompletedLessonIds);

      if (selected) {
        const score = calculatePriorityScore('weak_module', focus.masteryPercent, focus.unresolvedCount, false);
        rawCandidates.push({
          id: `rec-mod-${selected.id}`,
          type: recType,
          title: `Tăng cường kỹ năng ${focus.label}`,
          description: `Kỹ năng ${focus.label} đang đạt ${focus.masteryPercent}%. Cần làm thêm bài tập chuyên đề.`,
          route: `/${routeKind}/${selected.slug || selected.id}`,
          reason: 'weak_module',
          focusLabel: focus.label,
          masteryPercent: focus.masteryPercent,
          unresolvedCount: focus.unresolvedCount,
          sourceLessonId: selected.id,
          sourceLessonSlug: selected.slug,
          estimatedMinutes: 7,
          priorityScore: score,
        });
      }
    }
  }

  // Deduplicate candidates by route or sourceLessonId
  const uniqueCandidates: LearningRecommendation[] = [];
  const seenRoutes = new Set<string>();
  const seenLessonIds = new Set<string>();

  for (const c of rawCandidates) {
    const routeKey = c.route.toLowerCase();
    const lessonKey = c.sourceLessonId || '';

    if (!seenRoutes.has(routeKey) && (!lessonKey || !seenLessonIds.has(lessonKey))) {
      seenRoutes.add(routeKey);
      if (lessonKey) seenLessonIds.add(lessonKey);
      uniqueCandidates.push(c);
    }
  }

  // Sort candidates by priorityScore descending
  uniqueCandidates.sort((a, b) => b.priorityScore - a.priorityScore);

  const recommendations = uniqueCandidates.slice(0, 3);
  const primaryRecommendation = recommendations[0] || null;

  return {
    recommendations,
    primaryRecommendation,
    hasPersonalizedData: recommendations.length > 0,
  };
}
