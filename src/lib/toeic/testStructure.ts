/**
 * Canonical Structure & Helper Utilities for TOEIC Full Tests (Parts 1–7)
 */

export const CANONICAL_TOEIC_PARTS = [
  'part1',
  'part2',
  'part3',
  'part4',
  'part5',
  'part6',
  'part7',
] as const;

export type CanonicalToeicPart = (typeof CANONICAL_TOEIC_PARTS)[number];

export interface ToeicPartRange {
  part: CanonicalToeicPart;
  nameVi: string;
  startNumber: number;
  endNumber: number;
  expectedCount: number;
  expectedOptionCount: number;
}

export const TOEIC_FULL_TEST_STRUCTURE: Record<CanonicalToeicPart, ToeicPartRange> = {
  part1: { part: 'part1', nameVi: 'Part 1: Photographs', startNumber: 1, endNumber: 6, expectedCount: 6, expectedOptionCount: 4 },
  part2: { part: 'part2', nameVi: 'Part 2: Question-Response', startNumber: 7, endNumber: 31, expectedCount: 25, expectedOptionCount: 3 },
  part3: { part: 'part3', nameVi: 'Part 3: Conversations', startNumber: 32, endNumber: 70, expectedCount: 39, expectedOptionCount: 4 },
  part4: { part: 'part4', nameVi: 'Part 4: Talks', startNumber: 71, endNumber: 100, expectedCount: 30, expectedOptionCount: 4 },
  part5: { part: 'part5', nameVi: 'Part 5: Incomplete Sentences', startNumber: 101, endNumber: 130, expectedCount: 30, expectedOptionCount: 4 },
  part6: { part: 'part6', nameVi: 'Part 6: Text Completion', startNumber: 131, endNumber: 146, expectedCount: 16, expectedOptionCount: 4 },
  part7: { part: 'part7', nameVi: 'Part 7: Reading Comprehension', startNumber: 147, endNumber: 200, expectedCount: 54, expectedOptionCount: 4 },
};

/**
 * Normalize any raw string to canonical Part string (e.g. 'Part 1' -> 'part1')
 */
export function normalizeToeicPart(rawPart: string): CanonicalToeicPart {
  const cleaned = rawPart.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (cleaned === 'p1' || cleaned === 'part1' || cleaned === '1') return 'part1';
  if (cleaned === 'p2' || cleaned === 'part2' || cleaned === '2') return 'part2';
  if (cleaned === 'p3' || cleaned === 'part3' || cleaned === '3') return 'part3';
  if (cleaned === 'p4' || cleaned === 'part4' || cleaned === '4') return 'part4';
  if (cleaned === 'p5' || cleaned === 'part5' || cleaned === '5') return 'part5';
  if (cleaned === 'p6' || cleaned === 'part6' || cleaned === '6') return 'part6';
  if (cleaned === 'p7' || cleaned === 'part7' || cleaned === '7') return 'part7';
  return 'part1';
}

/**
 * Get expected TOEIC Part for a given question number (1..200)
 */
export function expectedPartForQuestionNumber(questionNumber: number): CanonicalToeicPart | null {
  if (questionNumber < 1 || questionNumber > 200) return null;
  for (const partKey of CANONICAL_TOEIC_PARTS) {
    const range = TOEIC_FULL_TEST_STRUCTURE[partKey];
    if (questionNumber >= range.startNumber && questionNumber <= range.endNumber) {
      return range.part;
    }
  }
  return null;
}

/**
 * Check if a question number is valid for a given TOEIC Part
 */
export function isQuestionNumberValidForPart(questionNumber: number, part: string): boolean {
  const norm = normalizeToeicPart(part);
  const range = TOEIC_FULL_TEST_STRUCTURE[norm];
  if (!range) return false;
  return questionNumber >= range.startNumber && questionNumber <= range.endNumber;
}

/**
 * Total expected questions in a full test (200)
 */
export function expectedFullTestQuestionCount(): number {
  return 200;
}

/**
 * Expected question count for a specific Part in a full test
 */
export function expectedPartQuestionCount(part: string): number {
  const norm = normalizeToeicPart(part);
  return TOEIC_FULL_TEST_STRUCTURE[norm]?.expectedCount || 0;
}

/**
 * Expected option count for a specific Part (3 for Part 2; 4 for all others)
 */
export function expectedOptionCountForPart(part: string): number {
  const norm = normalizeToeicPart(part);
  return TOEIC_FULL_TEST_STRUCTURE[norm]?.expectedOptionCount || 4;
}

/**
 * Return array of missing question numbers (1..200) given existing question numbers
 */
export function getMissingQuestionNumbers(existingNumbers: number[]): number[] {
  const existingSet = new Set(existingNumbers);
  const missing: number[] = [];
  for (let i = 1; i <= 200; i++) {
    if (!existingSet.has(i)) {
      missing.push(i);
    }
  }
  return missing;
}

/**
 * Calculate Part summary metrics from questions
 */
export function getPartSummary(questions?: Array<{ part: string; question_number: number; is_active?: boolean }>) {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const activeQs = safeQuestions.filter((q) => q && q.is_active === true);

  const summary: Record<string, { count: number; expected: number; isComplete: boolean; missing: number[] }> = {
    part1: { count: 0, expected: 6, isComplete: false, missing: [] },
    part2: { count: 0, expected: 25, isComplete: false, missing: [] },
    part3: { count: 0, expected: 39, isComplete: false, missing: [] },
    part4: { count: 0, expected: 30, isComplete: false, missing: [] },
    part5: { count: 0, expected: 30, isComplete: false, missing: [] },
    part6: { count: 0, expected: 16, isComplete: false, missing: [] },
    part7: { count: 0, expected: 54, isComplete: false, missing: [] },
  };

  const activeByPart: Record<string, Set<number>> = {
    part1: new Set(), part2: new Set(), part3: new Set(),
    part4: new Set(), part5: new Set(), part6: new Set(), part7: new Set()
  };

  activeQs.forEach((q) => {
    const norm = normalizeToeicPart(q.part);
    if (activeByPart[norm]) {
      activeByPart[norm].add(q.question_number);
    }
  });

  CANONICAL_TOEIC_PARTS.forEach((partKey) => {
    const s = summary[partKey as string];
    const activeSet = activeByPart[partKey as string];
    s.count = activeSet.size;
    
    const range = TOEIC_FULL_TEST_STRUCTURE[partKey];
    for (let i = range.startNumber; i <= range.endNumber; i++) {
      if (!activeSet.has(i)) {
        s.missing.push(i);
      }
    }
    s.isComplete = s.count === s.expected && s.missing.length === 0;
  });

  return summary;
}

