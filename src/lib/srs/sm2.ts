import { ReviewRating } from '../supabase/types';

export interface SRSItemState {
  repetitions: number;
  interval_days: number;
  ease_factor: number;
  next_review_at: string;
}

/**
 * Pure SRS Calculation Function (Simplified SuperMemo-2 Spaced Repetition Algorithm)
 * Encapsulated & easily upgradeable in future phases.
 */
export function calculateSRSNextReview(
  currentState?: Partial<SRSItemState>,
  rating: ReviewRating = 'good'
): SRSItemState {
  const currentReps = currentState?.repetitions ?? 0;
  const currentEase = currentState?.ease_factor ?? 2.5;

  let newReps = currentReps;
  let newInterval = 0;
  let newEase = currentEase;

  switch (rating) {
    case 'again':
      newReps = 0;
      newInterval = 0; // Due today / immediately
      newEase = Math.max(1.3, currentEase - 0.2);
      break;

    case 'hard':
      newReps = currentReps + 1;
      newInterval = currentReps === 0 ? 1 : Math.round((currentState?.interval_days ?? 1) * 1.2);
      newEase = Math.max(1.3, currentEase - 0.15);
      break;

    case 'good':
      newReps = currentReps + 1;
      if (currentReps === 0) {
        newInterval = 1;
      } else if (currentReps === 1) {
        newInterval = 3;
      } else {
        newInterval = Math.round((currentState?.interval_days ?? 3) * currentEase);
      }
      break;

    case 'easy':
      newReps = currentReps + 1;
      if (currentReps === 0) {
        newInterval = 4;
      } else if (currentReps === 1) {
        newInterval = 7;
      } else {
        newInterval = Math.round((currentState?.interval_days ?? 7) * currentEase * 1.3);
      }
      newEase = currentEase + 0.15;
      break;
  }

  // Calculate future next review timestamp
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + newInterval);

  return {
    repetitions: newReps,
    interval_days: newInterval,
    ease_factor: Number(newEase.toFixed(2)),
    next_review_at: nextDate.toISOString(),
  };
}
