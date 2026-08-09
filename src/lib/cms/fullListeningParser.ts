// ============================================================
// Phase P3.5F: Full Listening Bulk Import & PDF Image Extractor Helper
// ============================================================

import {
  RawMediaFile,
  mapSequentialMediaFiles,
  SequentialMediaType,
  Part2NumberingMode
} from './sequentialMediaParser';

export type BulkWorkflowMode = 'per_part' | 'full_listening';
export type Part1ImageSourceMode = 'files' | 'pdf';
export type FullListeningZoneKey = 'p1_image' | 'p1_audio' | 'p2_audio' | 'p3_audio' | 'p4_audio';

export interface ZoneStatus {
  key: FullListeningZoneKey;
  label: string;
  expectedCount: number;
  actualCount: number;
  completed: boolean;
  statusText: string;
  statusCode: 'complete' | 'incomplete' | 'invalid' | 'conflict' | 'empty';
  missingSequences: number[];
  part2Info?: {
    detectedMode: 'absolute' | 'sequential' | 'ambiguous';
    message: string;
  };
}

export interface FullListeningMappedItem {
  zoneKey: FullListeningZoneKey;
  rawName: string;
  file?: File;
  sequence: number | null;
  type: 'image' | 'audio';
  targetType: 'question' | 'group' | 'none';
  targetId?: string;
  targetLabel: string;
  currentExists: boolean;
  action: 'upload' | 'skip' | 'invalid' | 'conflict';
  status: 'pending' | 'ready' | 'skip' | 'invalid' | 'conflict' | 'uploading' | 'success' | 'failed';
  error?: string;
  pdfPageNum?: number;
  cropBox?: { x: number; y: number; width: number; height: number } | null;
}

export interface FullListeningParseResult {
  zoneItems: Record<FullListeningZoneKey, FullListeningMappedItem[]>;
  zoneStatuses: Record<FullListeningZoneKey, ZoneStatus>;
  globalSummary: {
    audioTargetCount: number; // expected 54
    audioMatchedCount: number;
    imageTargetCount: number; // expected 6
    imageMatchedCount: number;
    totalFiles: number;
    readyToUploadCount: number;
    existingSkipCount: number;
    invalidCount: number;
    conflictCount: number;
    missingCount: number;
  };
  part2Info?: {
    detectedMode: 'absolute' | 'sequential' | 'ambiguous';
    message: string;
  };
}

// 1. ZONE CONFIGURATION
export const FULL_LISTENING_ZONES: Array<{
  key: FullListeningZoneKey;
  label: string;
  expectedCount: number;
  type: 'image' | 'audio';
  minSeq: number;
  maxSeq: number;
}> = [
  { key: 'p1_image', label: 'Part 1 — Hình ảnh', expectedCount: 6, type: 'image', minSeq: 1, maxSeq: 6 },
  { key: 'p1_audio', label: 'Part 1 — Audio', expectedCount: 6, type: 'audio', minSeq: 1, maxSeq: 6 },
  { key: 'p2_audio', label: 'Part 2 — Audio', expectedCount: 25, type: 'audio', minSeq: 1, maxSeq: 25 },
  { key: 'p3_audio', label: 'Part 3 — Audio nhóm', expectedCount: 13, type: 'audio', minSeq: 1, maxSeq: 13 },
  { key: 'p4_audio', label: 'Part 4 — Audio nhóm', expectedCount: 10, type: 'audio', minSeq: 1, maxSeq: 10 },
];

// 2. SINGLE ZONE MAPPER (INDEPENDENT ZONE SCOPING)
export function mapFullListeningZone(
  zoneKey: FullListeningZoneKey,
  rawFiles: RawMediaFile[],
  questions: Array<{ id?: string; question_number: number; part: string; image_url?: string | null; audio_url?: string | null }>,
  groups: Array<{ id?: string; part: string; audio_url?: string | null }>,
  getGroupRange: (groupId: string) => { min: number; max: number },
  isPublished: boolean,
  part2NumberingMode: Part2NumberingMode = 'auto'
): { items: FullListeningMappedItem[]; status: ZoneStatus } {
  const zoneConfig = FULL_LISTENING_ZONES.find(z => z.key === zoneKey)!;

  // Use mapSequentialMediaFiles directly to ensure 100% parser consistency
  const mappedRes = mapSequentialMediaFiles(
    rawFiles,
    zoneKey as SequentialMediaType,
    questions,
    groups,
    getGroupRange,
    isPublished,
    part2NumberingMode
  );

  const items: FullListeningMappedItem[] = mappedRes.items.map(item => ({
    zoneKey,
    rawName: item.name,
    file: item.file,
    sequence: item.sequence,
    type: item.type,
    targetType: item.targetType,
    targetId: item.targetId,
    targetLabel: item.targetLabel,
    currentExists: item.currentExists,
    action: item.action,
    status: item.status,
    error: item.error,
  }));

  const validMatchedCount = mappedRes.counters.matched;
  const hasConflict = mappedRes.counters.conflict > 0;
  const hasInvalid = mappedRes.counters.invalid > 0;
  const isComplete = validMatchedCount === zoneConfig.expectedCount;

  let statusCode: ZoneStatus['statusCode'] = 'empty';
  let statusText = 'Chưa chọn file';

  if (items.length > 0) {
    if (hasConflict) {
      statusCode = 'conflict';
      statusText = '⚠ Trùng số thứ tự/nhóm';
    } else if (hasInvalid) {
      statusCode = 'invalid';
      statusText = '✕ File không hợp lệ';
    } else if (isComplete) {
      statusCode = 'complete';
      statusText = '✓ Hoàn tất';
    } else {
      statusCode = 'incomplete';
      statusText = `⚠ Thiếu ${mappedRes.counters.missingSequences.length}`;
    }
  }

  const status: ZoneStatus = {
    key: zoneKey,
    label: zoneConfig.label,
    expectedCount: zoneConfig.expectedCount,
    actualCount: validMatchedCount,
    completed: isComplete,
    statusText,
    statusCode,
    missingSequences: mappedRes.counters.missingSequences,
    part2Info: mappedRes.part2Info,
  };

  return { items, status };
}

// 3. MULTI-ZONE FULL LISTENING PARSER & SUMMARY CALCULATOR
export function mapAllFullListeningZones(
  zoneRawFiles: Record<FullListeningZoneKey, RawMediaFile[]>,
  questions: Array<{ id?: string; question_number: number; part: string; image_url?: string | null; audio_url?: string | null }>,
  groups: Array<{ id?: string; part: string; audio_url?: string | null }>,
  getGroupRange: (groupId: string) => { min: number; max: number },
  isPublished: boolean,
  part2NumberingMode: Part2NumberingMode = 'auto'
): FullListeningParseResult {
  const zoneItems = {} as Record<FullListeningZoneKey, FullListeningMappedItem[]>;
  const zoneStatuses = {} as Record<FullListeningZoneKey, ZoneStatus>;

  FULL_LISTENING_ZONES.forEach(z => {
    const raw = zoneRawFiles[z.key] || [];
    const res = mapFullListeningZone(z.key, raw, questions, groups, getGroupRange, isPublished, part2NumberingMode);
    zoneItems[z.key] = res.items;
    zoneStatuses[z.key] = res.status;
  });

  const allMappedItems = Object.values(zoneItems).flat();

  const audioItems = allMappedItems.filter(i => i.type === 'audio');
  const imageItems = allMappedItems.filter(i => i.type === 'image');

  const globalSummary = {
    audioTargetCount: 54,
    audioMatchedCount: audioItems.filter(i => i.status === 'ready' || i.status === 'skip').length,
    imageTargetCount: 6,
    imageMatchedCount: imageItems.filter(i => i.status === 'ready' || i.status === 'skip').length,
    totalFiles: allMappedItems.length,
    readyToUploadCount: allMappedItems.filter(i => i.action === 'upload' && (i.status === 'ready' || i.status === 'pending')).length,
    existingSkipCount: allMappedItems.filter(i => i.action === 'skip').length,
    invalidCount: allMappedItems.filter(i => i.status === 'invalid').length,
    conflictCount: allMappedItems.filter(i => i.status === 'conflict').length,
    missingCount: Object.values(zoneStatuses).reduce((acc, s) => acc + s.missingSequences.length, 0),
  };

  return {
    zoneItems,
    zoneStatuses,
    globalSummary,
    part2Info: zoneStatuses.p2_audio?.part2Info,
  };
}
