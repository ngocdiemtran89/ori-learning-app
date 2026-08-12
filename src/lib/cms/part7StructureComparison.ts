/**
 * Part 7 DB Structure Comparison & Repair Plan Generator
 * Compares detected source manifest against active DB question membership and passage fingerprints.
 */

import { Part7StructureManifest } from './part7StructureManifest';
import { computePassageFingerprint } from './part7StructureParser';

export interface DbGroupInfo {
  id: string;
  part: string;
  sort_order: number;
  passage: string;
  question_numbers: number[];
  min_qn: number;
  max_qn: number;
  has_bilingual_units?: boolean;
  has_evidence?: boolean;
}

export interface DbQuestionInfo {
  id: string;
  question_number: number;
  group_id: string;
}

export interface GroupComparisonItem {
  order: number;
  sourceRange: string;
  sourceStart: number;
  sourceEnd: number;
  sourceDocumentKind?: string;
  targetGroupId?: string;
  dbRange?: string;
  dbStart?: number;
  dbEnd?: number;
  status: 'MATCH' | 'RANGE_MISMATCH' | 'MEMBERSHIP_MISMATCH' | 'PASSAGE_MISMATCH';
  passageStatus: 'PASSAGE_MATCH' | 'PASSAGE_DIFFERENT' | 'PASSAGE_EMPTY';
  movedQuestions: { questionNumber: number; questionId?: string; fromGroupId: string; toGroupId: string }[];
}

export interface Part7RepairPlan {
  isApplyAllowed: boolean;
  blockReason?: string;
  groupCountMatch: boolean;
  sourceGroupCount: number;
  dbGroupCount: number;
  totalMovedQuestions: number;
  affectedGroupCount: number;
  expectedCurrentStructureHash: string;
  detectedStructureHash: string;
  groupComparisons: GroupComparisonItem[];
  questionMappings: { question_id: string; question_number: number; target_group_id: string }[];
}

/**
 * Computes structure hash from DB groups array.
 */
export function computeDbStructureHash(dbGroups: DbGroupInfo[]): string {
  if (!dbGroups || dbGroups.length === 0) return '';
  const valid = dbGroups.filter((g) => g.question_numbers && g.question_numbers.length > 0);
  const sorted = [...valid].sort((a, b) => a.min_qn - b.min_qn);
  return sorted.map((g) => `${g.min_qn}-${g.max_qn}`).join('|');
}

/**
 * Main DB Structure Comparison & Repair Plan Generator
 */
export function compareStructureWithDatabase(
  manifest: Part7StructureManifest,
  dbGroups: DbGroupInfo[],
  dbQuestions: DbQuestionInfo[],
  isPublished: boolean
): Part7RepairPlan {
  const currentDbHash = computeDbStructureHash(dbGroups);
  const targetHash = manifest.structureHash;

  const sourceGroups = manifest.groups;
  const dbGroupCount = dbGroups.length;
  const sourceGroupCount = sourceGroups.length;

  const groupCountMatch = dbGroupCount === sourceGroupCount;

  // Protected metadata check
  const hasProtectedMetadata = dbGroups.some((g) => g.has_bilingual_units || g.has_evidence);

  let isApplyAllowed = true;
  let blockReason: string | undefined = undefined;

  if (isPublished) {
    isApplyAllowed = false;
    blockReason = '🟡 ĐỀ ĐANG PUBLISHED. Bạn có thể quét và xem Repair Plan. Để áp dụng sửa cấu trúc: hãy chuyển đề về Draft trước.';
  } else if (hasProtectedMetadata) {
    isApplyAllowed = false;
    blockReason = '⚠ Nhóm này đã có bilingual units / evidence metadata. Cần review trước khi thay cấu trúc.';
  } else if (!groupCountMatch && dbGroupCount > 0) {
    isApplyAllowed = false;
    blockReason = `⚠ Số group DB (${dbGroupCount}) khác số bài đọc nguồn (${sourceGroupCount}). Direct repair disabled.`;
  }

  // Sort DB groups stably by minimum question number
  const sortedDbGroups = [...dbGroups]
    .filter((g) => g.question_numbers && g.question_numbers.length > 0)
    .sort((a, b) => a.min_qn - b.min_qn);

  const groupComparisons: GroupComparisonItem[] = [];
  const questionMappings: { question_id: string; question_number: number; target_group_id: string }[] = [];
  let totalMovedQuestions = 0;
  const affectedGroupSet = new Set<string>();

  sourceGroups.forEach((sg, sIdx) => {
    const targetDbGroup = groupCountMatch ? sortedDbGroups[sIdx] : undefined;
    const targetGroupId = targetDbGroup?.id;

    const sourceRangeStr = `Q${sg.startQuestion}–${sg.endQuestion}`;
    const dbRangeStr = targetDbGroup ? `Q${targetDbGroup.min_qn}–${targetDbGroup.max_qn}` : undefined;

    // Check passage fingerprint
    let passageStatus: GroupComparisonItem['passageStatus'] = 'PASSAGE_EMPTY';
    if (targetDbGroup && targetDbGroup.passage && targetDbGroup.passage.trim()) {
      const dbPassageFp = computePassageFingerprint(targetDbGroup.passage);
      if (sg.passageFingerprint && sg.passageFingerprint === dbPassageFp) {
        passageStatus = 'PASSAGE_MATCH';
      } else {
        passageStatus = 'PASSAGE_DIFFERENT';
      }
    }

    const movedForThisGroup: GroupComparisonItem['movedQuestions'] = [];

    // Map each question number in source group to target DB group ID
    sg.questionNumbers.forEach((qNum) => {
      const qObj = dbQuestions.find((q) => q.question_number === qNum);
      if (qObj && targetGroupId) {
        questionMappings.push({
          question_id: qObj.id,
          question_number: qNum,
          target_group_id: targetGroupId,
        });

        if (qObj.group_id !== targetGroupId) {
          totalMovedQuestions++;
          affectedGroupSet.add(qObj.group_id);
          affectedGroupSet.add(targetGroupId);
          movedForThisGroup.push({
            questionNumber: qNum,
            questionId: qObj.id,
            fromGroupId: qObj.group_id,
            toGroupId: targetGroupId,
          });
        }
      }
    });

    // Evaluate status
    let status: GroupComparisonItem['status'] = 'MATCH';
    if (!targetDbGroup) {
      status = 'MEMBERSHIP_MISMATCH';
    } else if (sg.startQuestion !== targetDbGroup.min_qn || sg.endQuestion !== targetDbGroup.max_qn) {
      status = 'RANGE_MISMATCH';
    } else if (movedForThisGroup.length > 0) {
      status = 'MEMBERSHIP_MISMATCH';
    } else if (passageStatus === 'PASSAGE_DIFFERENT') {
      status = 'PASSAGE_MISMATCH';
    }

    groupComparisons.push({
      order: sg.order,
      sourceRange: sourceRangeStr,
      sourceStart: sg.startQuestion,
      sourceEnd: sg.endQuestion,
      sourceDocumentKind: sg.documentKind,
      targetGroupId,
      dbRange: dbRangeStr,
      dbStart: targetDbGroup?.min_qn,
      dbEnd: targetDbGroup?.max_qn,
      status,
      passageStatus,
      movedQuestions: movedForThisGroup,
    });
  });

  return {
    isApplyAllowed,
    blockReason,
    groupCountMatch,
    sourceGroupCount,
    dbGroupCount,
    totalMovedQuestions,
    affectedGroupCount: affectedGroupSet.size,
    expectedCurrentStructureHash: currentDbHash,
    detectedStructureHash: targetHash,
    groupComparisons,
    questionMappings,
  };
}
