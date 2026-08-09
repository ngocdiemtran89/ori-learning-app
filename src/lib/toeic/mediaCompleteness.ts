import { normalizeToeicPart } from './testStructure';
import { ToeicTestGroupInput, ToeicTestQuestionInput } from '../cms/testBankValidation';

export interface MediaMetric {
  ready: number;
  expected: number;
  missing: (number | string)[]; // question_number or human-readable group label
}

export interface MediaCompleteness {
  part1Images: MediaMetric;
  part1Audio: MediaMetric;
  part2Audio: MediaMetric;
  part3Audio: MediaMetric;
  part4Audio: MediaMetric;
  publishReady: boolean;
}

export interface GroupQuestionRange {
  min: number;
  max: number;
  label: string;
}

/**
 * Calculate the question number range for a group from its active child questions.
 * Returns a human-readable label like "Q32–34" or "Q32" for single-question groups.
 * Uses only active questions (is_active === true).
 */
export function getToeicGroupQuestionRange(
  groupId: string,
  questions: ToeicTestQuestionInput[]
): GroupQuestionRange {
  const activeChildNums = questions
    .filter(q => q.group_id === groupId && q.is_active === true)
    .map(q => q.question_number)
    .sort((a, b) => a - b);

  if (activeChildNums.length === 0) {
    return { min: Infinity, max: Infinity, label: 'Group' };
  }

  const min = activeChildNums[0];
  const max = activeChildNums[activeChildNums.length - 1];
  const label = min === max ? `Q${min}` : `Q${min}–${max}`;

  return { min, max, label };
}

/**
 * Sort groups by the minimum active child question number (ascending).
 */
export function sortGroupsByQuestionRange(
  groups: ToeicTestGroupInput[],
  questions: ToeicTestQuestionInput[]
): ToeicTestGroupInput[] {
  return [...groups].sort((a, b) => {
    const rangeA = getToeicGroupQuestionRange(a.id!, questions);
    const rangeB = getToeicGroupQuestionRange(b.id!, questions);
    return rangeA.min - rangeB.min;
  });
}

export function getMediaCompleteness(
  groups: ToeicTestGroupInput[],
  questions: ToeicTestQuestionInput[]
): MediaCompleteness {
  const activeQs = questions.filter(q => q.is_active !== false);
  const activeGs = groups.filter(g => g.is_active !== false);

  const metrics: MediaCompleteness = {
    part1Images: { ready: 0, expected: 0, missing: [] },
    part1Audio: { ready: 0, expected: 0, missing: [] },
    part2Audio: { ready: 0, expected: 0, missing: [] },
    part3Audio: { ready: 0, expected: 0, missing: [] },
    part4Audio: { ready: 0, expected: 0, missing: [] },
    publishReady: true
  };

  // Process Questions
  activeQs.forEach(q => {
    const normPart = normalizeToeicPart(q.part);
    const g = q.group_id ? activeGs.find(grp => grp.id === q.group_id) : null;

    if (normPart === 'part1') {
      metrics.part1Images.expected++;
      metrics.part1Audio.expected++;

      if (q.image_url || (g && g.image_url)) {
        metrics.part1Images.ready++;
      } else {
        metrics.part1Images.missing.push(q.question_number);
      }

      if (q.audio_url || (g && g.audio_url)) {
        metrics.part1Audio.ready++;
      } else {
        metrics.part1Audio.missing.push(q.question_number);
      }
    } else if (normPart === 'part2') {
      metrics.part2Audio.expected++;
      
      if (q.audio_url || (g && g.audio_url)) {
        metrics.part2Audio.ready++;
      } else {
        metrics.part2Audio.missing.push(q.question_number);
      }
    }
  });

  // Process Groups (Part 3 & 4) — push human-readable labels, not UUIDs
  activeGs.forEach(g => {
    const normPart = normalizeToeicPart(g.part);
    const range = getToeicGroupQuestionRange(g.id!, questions);

    if (normPart === 'part3') {
      metrics.part3Audio.expected++;
      if (g.audio_url) {
        metrics.part3Audio.ready++;
      } else {
        metrics.part3Audio.missing.push(range.label);
      }
    } else if (normPart === 'part4') {
      metrics.part4Audio.expected++;
      if (g.audio_url) {
        metrics.part4Audio.ready++;
      } else {
        metrics.part4Audio.missing.push(range.label);
      }
    }
  });

  // Check publish readiness based on required media
  if (
    metrics.part1Images.missing.length > 0 ||
    metrics.part1Audio.missing.length > 0 ||
    metrics.part2Audio.missing.length > 0 ||
    metrics.part3Audio.missing.length > 0 ||
    metrics.part4Audio.missing.length > 0
  ) {
    metrics.publishReady = false;
  }

  return metrics;
}
