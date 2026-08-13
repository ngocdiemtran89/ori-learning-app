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
  documents?: any[];
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
  passageStatus: 'PASSAGE_MATCH' | 'PASSAGE_DIFFERENT' | 'PASSAGE_EMPTY' | 'PASSAGE_NOT_FOUND' | 'PASSAGE_AMBIGUOUS';
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
 * Computes exact-membership source structure hash from DB groups array (group-ID independent).
 * Representation: "147,148|149,150,151|..."
 */
export function computeDbStructureHash(dbGroups: DbGroupInfo[]): string {
  if (!dbGroups || dbGroups.length === 0) return '';
  const valid = dbGroups.filter((g) => g.question_numbers && g.question_numbers.length > 0);
  const sorted = [...valid].sort((a, b) => a.min_qn - b.min_qn);
  return sorted.map((g) => [...g.question_numbers].sort((x, y) => x - y).join(',')).join('|');
}

/**
 * Computes DB assignment lock hash incorporating group UUIDs:
 * Format: "<group_uuid_A>:147,148|<group_uuid_B>:149,150,151|..."
 * Distinguishes swapped group assignments between identical ranges!
 */
export function computeDbAssignmentLockHash(dbGroups: DbGroupInfo[]): string {
  if (!dbGroups || dbGroups.length === 0) return '';
  const valid = dbGroups.filter((g) => g.question_numbers && g.question_numbers.length > 0);
  const sorted = [...valid].sort((a, b) => a.min_qn - b.min_qn);
  return sorted.map((g) => `${g.id}:${[...g.question_numbers].sort((x, y) => x - y).join(',')}`).join('|');
}

/**
 * Computes manifest assignment lock hash incorporating targetGroupId:
 * Format: "<targetGroupId>:147,148|<targetGroupId>:149,150,151|..."
 */
export function computeManifestAssignmentLockHash(groups: { targetGroupId?: string; startQuestion: number; endQuestion: number; questionNumbers: number[] }[]): string {
  if (!groups || groups.length === 0) return '';
  const sorted = [...groups].sort((a, b) => a.startQuestion - b.startQuestion);
  return sorted
    .map((g) => `${g.targetGroupId || 'unassigned'}:${[...g.questionNumbers].sort((x, y) => x - y).join(',')}`)
    .join('|');
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
  const currentDbAssignmentHash = computeDbAssignmentLockHash(dbGroups);

  const sourceGroups = manifest.groups;
  const dbGroupCount = dbGroups.length;
  const sourceGroupCount = sourceGroups.length;

  const groupCountMatch = dbGroupCount === sourceGroupCount;

  // Compute passage fingerprints for each DB group
  const dbGroupFingerprints = dbGroups.map((g) => ({
    group: g,
    fingerprint: computePassageFingerprint(g.passage, g.documents),
  }));

  // Protected metadata check
  const hasProtectedMetadata = dbGroups.some((g) => g.has_bilingual_units || g.has_evidence);

  const groupComparisons: GroupComparisonItem[] = [];
  const questionMappings: { question_id: string; question_number: number; target_group_id: string }[] = [];
  let totalMovedQuestions = 0;
  const affectedGroupSet = new Set<string>();

  // Track assigned target group IDs to detect duplicates/ambiguity
  const assignedTargetGroupIds = new Set<string>();

  sourceGroups.forEach((sg) => {
    let targetDbGroup: DbGroupInfo | undefined = undefined;
    let passageStatus: GroupComparisonItem['passageStatus'] = 'PASSAGE_EMPTY';

    const sourceFp = sg.passageFingerprint;

    if (!sourceFp) {
      passageStatus = 'PASSAGE_EMPTY';
    } else {
      // Find matching DB groups by passage fingerprint
      const matchingDbGroups = dbGroupFingerprints.filter(
        (dbg) => dbg.fingerprint && dbg.fingerprint === sourceFp
      );

      if (matchingDbGroups.length === 1) {
        targetDbGroup = matchingDbGroups[0].group;
        passageStatus = 'PASSAGE_MATCH';
      } else if (matchingDbGroups.length > 1) {
        passageStatus = 'PASSAGE_AMBIGUOUS';
      } else {
        // 0 matches found for this passage fingerprint
        // If a targetGroupId was explicitly provided (e.g. from manal mapping), check that specific group
        if (sg.targetGroupId) {
          const explicitDbGroup = dbGroups.find((g) => g.id === sg.targetGroupId);
          if (explicitDbGroup) {
            const expFp = computePassageFingerprint(explicitDbGroup.passage, explicitDbGroup.documents);
            if (expFp && expFp === sourceFp) {
              targetDbGroup = explicitDbGroup;
              passageStatus = 'PASSAGE_MATCH';
            } else {
              targetDbGroup = explicitDbGroup;
              passageStatus = 'PASSAGE_DIFFERENT';
            }
          } else {
            passageStatus = 'PASSAGE_NOT_FOUND';
          }
        } else {
          passageStatus = 'PASSAGE_NOT_FOUND';
        }
      }
    }

    // Set or keep targetGroupId ONLY if we have a valid targetDbGroup
    if (targetDbGroup) {
      sg.targetGroupId = targetDbGroup.id;
      assignedTargetGroupIds.add(targetDbGroup.id);
    } else {
      delete sg.targetGroupId;
    }

    const targetGroupId = targetDbGroup?.id;
    const sourceRangeStr = `Q${sg.startQuestion}–${sg.endQuestion}`;
    const dbRangeStr = targetDbGroup ? `Q${targetDbGroup.min_qn}–${targetDbGroup.max_qn}` : undefined;

    const movedForThisGroup: GroupComparisonItem['movedQuestions'] = [];

    // Map each question number in source group to target DB group ID
    if (targetGroupId) {
      sg.questionNumbers.forEach((qNum) => {
        const qObj = dbQuestions.find((q) => q.question_number === qNum);
        if (qObj) {
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
    }

    // Evaluate status
    let status: GroupComparisonItem['status'] = 'MATCH';
    if (!targetDbGroup || passageStatus === 'PASSAGE_NOT_FOUND' || passageStatus === 'PASSAGE_AMBIGUOUS') {
      status = 'MEMBERSHIP_MISMATCH';
    } else if (passageStatus === 'PASSAGE_DIFFERENT') {
      status = 'PASSAGE_MISMATCH';
    } else if (sg.startQuestion !== targetDbGroup.min_qn || sg.endQuestion !== targetDbGroup.max_qn) {
      status = 'RANGE_MISMATCH';
    } else if (movedForThisGroup.length > 0) {
      status = 'MEMBERSHIP_MISMATCH';
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

  const targetAssignmentHash = computeManifestAssignmentLockHash(sourceGroups);
  manifest.structureHash = targetAssignmentHash;

  // Determine lock-readiness (isApplyAllowed)
  let isApplyAllowed = true;
  let blockReason: string | undefined = undefined;

  const hasUnresolvedPassage = groupComparisons.some((gc) => !gc.targetGroupId);
  const hasMismatchedPassage = groupComparisons.some((gc) => gc.passageStatus !== 'PASSAGE_MATCH');
  const hasDuplicateTargets = assignedTargetGroupIds.size < sourceGroups.filter((g) => g.targetGroupId).length;

  if (isPublished) {
    isApplyAllowed = false;
    blockReason = '🟡 ĐỀ ĐANG PUBLISHED. Bạn có thể quét và xem Repair Plan. Để áp dụng sửa cấu trúc: hãy chuyển đề về Draft trước.';
  } else if (hasProtectedMetadata) {
    isApplyAllowed = false;
    blockReason = '⚠ Nhóm này đã có bilingual units / evidence metadata. Cần review trước khi thay cấu trúc.';
  } else if (!groupCountMatch && dbGroupCount > 0) {
    isApplyAllowed = false;
    blockReason = `⚠ Số group DB (${dbGroupCount}) khác số bài đọc nguồn (${sourceGroupCount}). Direct repair disabled.`;
  } else if (hasUnresolvedPassage || hasMismatchedPassage) {
    isApplyAllowed = false;
    const countUnresolved = groupComparisons.filter((gc) => !gc.targetGroupId).length;
    const countMismatched = groupComparisons.filter((gc) => gc.passageStatus === 'PASSAGE_DIFFERENT').length;
    blockReason = `⚠ Bài đọc chưa được ghép chính xác: ${countUnresolved} bài chưa tìm thấy/bị trùng lặp, ${countMismatched} bài bị sai khác nội dung (passage mismatch). Khóa cấu trúc bị chặn.`;
  } else if (hasDuplicateTargets) {
    isApplyAllowed = false;
    blockReason = '⚠ Phát hiện trùng lặp targetGroupId giữa các bài đọc. Mọi bài đọc phải khớp 1-1 với DB group.';
  }

  return {
    isApplyAllowed,
    blockReason,
    groupCountMatch,
    sourceGroupCount,
    dbGroupCount,
    totalMovedQuestions,
    affectedGroupCount: affectedGroupSet.size,
    expectedCurrentStructureHash: currentDbAssignmentHash,
    detectedStructureHash: targetAssignmentHash,
    groupComparisons,
    questionMappings,
  };
}

