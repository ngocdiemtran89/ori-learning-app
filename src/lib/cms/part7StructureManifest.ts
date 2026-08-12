/**
 * Part 7 Canonical Structure Manifest & Fingerprint Builder
 * Enforces exact Q147-200 completeness (54 unique questions) and builds structureHash.
 */

import { Part7DetectedStructureGroup } from './part7StructureParser';

export interface Part7StructureManifestGroup {
  order: number;
  startQuestion: number;
  endQuestion: number;
  questionNumbers: number[];
  sourceHeader: string;
  documentKind?: string;
  passageFingerprint?: string;
}

export interface Part7StructureManifest {
  version: 1;
  part: 'part7';
  startQuestion: 147;
  endQuestion: 200;
  questionCount: 54;
  groupCount: number;
  groups: Part7StructureManifestGroup[];
  structureHash: string;
}

export interface ManifestValidationResult {
  isValid: boolean;
  manifest: Part7StructureManifest | null;
  errors: string[];
  warnings: string[];
  totalQuestionsFound: number;
  missingQuestions: number[];
  duplicateQuestions: number[];
  overlappingGroups: string[];
}

/**
 * Computes a deterministic structureHash based ONLY on group question ranges.
 * Format: "147-148|149-151|152-154|..."
 */
export function computeStructureHash(groups: { startQuestion: number; endQuestion: number }[]): string {
  if (!groups || groups.length === 0) return '';
  const sorted = [...groups].sort((a, b) => a.startQuestion - b.startQuestion);
  return sorted.map((g) => `${g.startQuestion}-${g.endQuestion}`).join('|');
}

/**
 * Builds and validates a Part7StructureManifest from detected groups across one or multiple batches.
 */
export function buildPart7StructureManifest(detectedGroups: Part7DetectedStructureGroup[]): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!detectedGroups || detectedGroups.length === 0) {
    return {
      isValid: false,
      manifest: null,
      errors: ['Chưa phát hiện nhóm bài đọc nào từ văn bản nguồn.'],
      warnings: [],
      totalQuestionsFound: 0,
      missingQuestions: Array.from({ length: 54 }, (_, i) => 147 + i),
      duplicateQuestions: [],
      overlappingGroups: [],
    };
  }

  // Sort groups by startQuestion
  const sortedGroups = [...detectedGroups].sort((a, b) => a.startQuestion - b.startQuestion);

  const seenQuestions = new Map<number, number>(); // qNum -> groupOrder
  const duplicateQuestions: number[] = [];
  const overlappingGroups: string[] = [];

  sortedGroups.forEach((g, gIdx) => {
    // Check individual group validity
    if (g.status === 'invalid' && g.validationError) {
      errors.push(`Nhóm ${gIdx + 1} (${g.sourceHeader}): ${g.validationError}`);
    }
    if (g.status === 'incomplete' && g.validationError) {
      warnings.push(`Nhóm ${gIdx + 1} (${g.sourceHeader}): ${g.validationError}`);
    }

    // Check for duplicates & overlaps
    g.questionNumbers.forEach((qNum) => {
      if (qNum < 147 || qNum > 200) {
        errors.push(`Câu Q${qNum} nằm ngoài dải quy định Q147–200.`);
      }
      if (seenQuestions.has(qNum)) {
        if (!duplicateQuestions.includes(qNum)) duplicateQuestions.push(qNum);
        const prevGroup = seenQuestions.get(qNum);
        overlappingGroups.push(`Câu Q${qNum} xuất hiện ở cả Nhóm ${prevGroup} và Nhóm ${gIdx + 1}`);
      } else {
        seenQuestions.set(qNum, gIdx + 1);
      }
    });
  });

  // Calculate missing questions in Q147-200 range
  const missingQuestions: number[] = [];
  for (let q = 147; q <= 200; q++) {
    if (!seenQuestions.has(q)) {
      missingQuestions.push(q);
    }
  }

  const uniqueCount = seenQuestions.size;

  if (duplicateQuestions.length > 0) {
    errors.push(`Phát hiện ${duplicateQuestions.length} câu trùng lặp: ${duplicateQuestions.map((q) => `Q${q}`).join(', ')}`);
  }

  if (missingQuestions.length > 0) {
    errors.push(`Thiếu ${missingQuestions.length} câu trong dải Q147–200: ${missingQuestions.map((q) => `Q${q}`).join(', ')}`);
  }

  if (uniqueCount !== 54) {
    errors.push(`Tổng số câu độc nhất thu được là ${uniqueCount}/54 (yêu cầu đúng 54 câu từ Q147 đến Q200).`);
  }

  const isValid = errors.length === 0;

  let manifest: Part7StructureManifest | null = null;

  if (isValid) {
    const manifestGroups: Part7StructureManifestGroup[] = sortedGroups.map((g, idx) => ({
      order: idx + 1,
      startQuestion: g.startQuestion,
      endQuestion: g.endQuestion,
      questionNumbers: g.questionNumbers,
      sourceHeader: g.sourceHeader,
      documentKind: g.documentKind,
      passageFingerprint: g.passageFingerprint,
    }));

    const hash = computeStructureHash(manifestGroups);

    manifest = {
      version: 1,
      part: 'part7',
      startQuestion: 147,
      endQuestion: 200,
      questionCount: 54,
      groupCount: manifestGroups.length,
      groups: manifestGroups,
      structureHash: hash,
    };
  }

  return {
    isValid,
    manifest,
    errors,
    warnings,
    totalQuestionsFound: uniqueCount,
    missingQuestions,
    duplicateQuestions,
    overlappingGroups,
  };
}
