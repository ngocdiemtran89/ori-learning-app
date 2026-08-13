/**
 * Canonical TOEIC Structure Rules & Thresholds Constants
 */

export const LOW_TEXT_CHAR_THRESHOLD = 150;
export const EMPTY_TEXT_CHAR_THRESHOLD = 10;

export const PART_BOUNDARIES = {
  PART1: { min: 1, max: 6, total: 6 },
  PART2: { min: 7, max: 31, total: 25 },
  PART3: { min: 32, max: 70, total: 39, groupSize: 3, totalGroups: 13 },
  PART4: { min: 71, max: 100, total: 30, groupSize: 3, totalGroups: 10 },
  PART5: { min: 101, max: 130, total: 30 },
  PART6: { min: 131, max: 146, total: 16, groupSize: 4, totalGroups: 4 },
  PART7: { min: 147, max: 200, total: 54 },
} as const;

export const PART3_CANONICAL_GROUPS = [
  [32, 34],
  [35, 37],
  [38, 40],
  [41, 43],
  [44, 46],
  [47, 49],
  [50, 52],
  [53, 55],
  [56, 58],
  [59, 61],
  [62, 64],
  [65, 67],
  [68, 70],
] as const;

export const PART4_CANONICAL_GROUPS = [
  [71, 73],
  [74, 76],
  [77, 79],
  [80, 82],
  [83, 85],
  [86, 88],
  [89, 91],
  [92, 94],
  [95, 97],
  [98, 100],
] as const;

export const PART6_CANONICAL_GROUPS = [
  [131, 134],
  [135, 138],
  [139, 142],
  [143, 146],
] as const;
