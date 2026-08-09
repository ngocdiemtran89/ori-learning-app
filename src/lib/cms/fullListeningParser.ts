// ============================================================
// Phase P3.5F: Full Listening Bulk Import & PDF Image Extractor Helper
// ============================================================

import {
  parseNativeFilename,
  isMacNoiseFile,
  RawMediaFile
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
  isPublished: boolean
): { items: FullListeningMappedItem[]; status: ZoneStatus } {
  const zoneConfig = FULL_LISTENING_ZONES.find(z => z.key === zoneKey)!;
  const filtered = rawFiles.filter(f => !isMacNoiseFile(f.name));

  const parsed = filtered.map(f => {
    let nativeInfo = parseNativeFilename(f.name);

    // Fallback: check canonical ORI format (e.g. q001.jpg, q001.mp3, q032-034.mp3)
    if (nativeInfo.sequence === null || (zoneKey === 'p3_audio' || zoneKey === 'p4_audio')) {
      const cleanName = f.name.toLowerCase().trim();
      const basename = cleanName.split('/').pop() || cleanName;

      // Group ORI match: q032-034.mp3
      const grpMatch = basename.match(/^q0*([3-9][0-9]|100)-0*([3-9][0-9]|100)\.(mp3|wav|ogg|m4a)$/);
      if (grpMatch) {
        const startQ = parseInt(grpMatch[1], 10);
        if (zoneKey === 'p3_audio' && startQ >= 32 && startQ <= 68) {
          const seq = Math.floor((startQ - 32) / 3) + 1;
          nativeInfo = { ...nativeInfo, sequence: seq };
        } else if (zoneKey === 'p4_audio' && startQ >= 71 && startQ <= 98) {
          const seq = Math.floor((startQ - 71) / 3) + 1;
          nativeInfo = { ...nativeInfo, sequence: seq };
        }
      }

      // Single Q ORI match: q001.mp3, q007.mp3...
      const qMatch = basename.match(/^q0*([1-9]|[12][0-9]|3[01])\.(mp3|wav|ogg|m4a|jpg|jpeg|png|webp)$/);
      if (qMatch) {
        const qNum = parseInt(qMatch[1], 10);
        if (zoneKey === 'p1_image' || zoneKey === 'p1_audio') {
          if (qNum <= 6) nativeInfo = { ...nativeInfo, sequence: qNum };
        } else if (zoneKey === 'p2_audio') {
          if (qNum >= 7 && qNum <= 31) nativeInfo = { ...nativeInfo, sequence: qNum - 6 };
        }
      }
    }

    return {
      ...f,
      parsedInfo: nativeInfo,
    };
  });

  // Sort numerically by sequence
  parsed.sort((a, b) => {
    const seqA = a.parsedInfo.sequence ?? Number.MAX_SAFE_INTEGER;
    const seqB = b.parsedInfo.sequence ?? Number.MAX_SAFE_INTEGER;
    if (seqA !== seqB) return seqA - seqB;
    return a.name.localeCompare(b.name);
  });

  const isImageZone = zoneConfig.type === 'image';
  const validExtensions = isImageZone ? ['jpg', 'jpeg', 'png', 'webp'] : ['mp3', 'wav', 'ogg', 'm4a'];

  // Track sequence counts WITHIN THIS ZONE ONLY
  const seqCounts = new Map<number, number>();
  parsed.forEach(f => {
    if (f.parsedInfo.sequence !== null) {
      seqCounts.set(f.parsedInfo.sequence, (seqCounts.get(f.parsedInfo.sequence) || 0) + 1);
    }
  });

  const presentSequences = new Set<number>();
  const items: FullListeningMappedItem[] = [];

  parsed.forEach(item => {
    const { rawName, extension, sequence } = item.parsedInfo;

    // Extension Check
    if (!validExtensions.includes(extension)) {
      items.push({
        zoneKey,
        rawName,
        file: item.file,
        sequence,
        type: zoneConfig.type,
        targetType: 'none',
        targetLabel: 'Không khớp loại media',
        currentExists: false,
        action: 'invalid',
        status: 'invalid',
        error: isImageZone ? 'File không phải là hình ảnh (jpg, png...)' : 'File không phải là audio (mp3, wav...)',
      });
      return;
    }

    // Missing sequence Check
    if (sequence === null) {
      items.push({
        zoneKey,
        rawName,
        file: item.file,
        sequence: null,
        type: zoneConfig.type,
        targetType: 'none',
        targetLabel: 'Thiếu số thứ tự',
        currentExists: false,
        action: 'invalid',
        status: 'invalid',
        error: 'Tên file không chứa số thứ tự hợp lệ',
      });
      return;
    }

    // Duplicate Check in THIS ZONE
    if ((seqCounts.get(sequence) || 0) > 1) {
      items.push({
        zoneKey,
        rawName,
        file: item.file,
        sequence,
        type: zoneConfig.type,
        targetType: 'none',
        targetLabel: `Trùng số thứ tự #${sequence}`,
        currentExists: false,
        action: 'conflict',
        status: 'conflict',
        error: `Phát hiện nhiều file trong phần này cùng chứa số thứ tự #${sequence}`,
      });
      return;
    }

    // Range Check
    if (sequence < zoneConfig.minSeq || sequence > zoneConfig.maxSeq) {
      items.push({
        zoneKey,
        rawName,
        file: item.file,
        sequence,
        type: zoneConfig.type,
        targetType: 'none',
        targetLabel: `Ngoài phạm vi (#${sequence})`,
        currentExists: false,
        action: 'invalid',
        status: 'invalid',
        error: `Số thứ tự #${sequence} nằm ngoài phạm vi ${zoneConfig.minSeq}–${zoneConfig.maxSeq} cho phần này`,
      });
      return;
    }

    presentSequences.add(sequence);

    // Target Resolution
    let targetQNum: number | null = null;
    let startQ: number | null = null;
    let endQ: number | null = null;
    let isGroup = false;

    if (zoneKey === 'p1_image' || zoneKey === 'p1_audio') {
      targetQNum = sequence; // 1..6 -> Q1..Q6
    } else if (zoneKey === 'p2_audio') {
      targetQNum = 6 + sequence; // 1..25 -> Q7..Q31
    } else if (zoneKey === 'p3_audio') {
      isGroup = true;
      startQ = 32 + (sequence - 1) * 3;
      endQ = startQ + 2;
    } else if (zoneKey === 'p4_audio') {
      isGroup = true;
      startQ = 71 + (sequence - 1) * 3;
      endQ = startQ + 2;
    }

    if (!isGroup && targetQNum !== null) {
      const q = questions.find(x => x.question_number === targetQNum);
      if (!q || !q.id) {
        items.push({
          zoneKey,
          rawName,
          file: item.file,
          sequence,
          type: zoneConfig.type,
          targetType: 'question',
          targetLabel: `Q${targetQNum}`,
          currentExists: false,
          action: 'invalid',
          status: 'invalid',
          error: `Không tìm thấy câu hỏi Q${targetQNum} trong đề thi`,
        });
        return;
      }

      const currentExists = isImageZone ? Boolean(q.image_url) : Boolean(q.audio_url);
      const action = isPublished && currentExists ? 'skip' : 'upload';

      items.push({
        zoneKey,
        rawName,
        file: item.file,
        sequence,
        type: zoneConfig.type,
        targetType: 'question',
        targetId: q.id,
        targetLabel: `Q${targetQNum} (${isImageZone ? 'Hình ảnh' : 'Audio'})`,
        currentExists,
        action,
        status: action === 'skip' ? 'skip' : 'ready',
      });
    } else if (isGroup && startQ !== null && endQ !== null) {
      const matchingGroups = groups.filter(g => {
        if (!g.id) return false;
        const r = getGroupRange(g.id);
        return r.min === startQ && r.max === endQ;
      });

      if (matchingGroups.length === 0) {
        items.push({
          zoneKey,
          rawName,
          file: item.file,
          sequence,
          type: 'audio',
          targetType: 'group',
          targetLabel: `Q${startQ}–${endQ}`,
          currentExists: false,
          action: 'invalid',
          status: 'invalid',
          error: `Không tìm thấy nhóm câu hỏi Q${startQ}–${endQ}`,
        });
        return;
      }

      if (matchingGroups.length > 1) {
        items.push({
          zoneKey,
          rawName,
          file: item.file,
          sequence,
          type: 'audio',
          targetType: 'group',
          targetLabel: `Q${startQ}–${endQ}`,
          currentExists: false,
          action: 'invalid',
          status: 'invalid',
          error: `Tìm thấy nhiều hơn 1 nhóm khớp với dải câu Q${startQ}–${endQ}`,
        });
        return;
      }

      const g = matchingGroups[0];
      const currentExists = Boolean(g.audio_url);
      const action = isPublished && currentExists ? 'skip' : 'upload';

      items.push({
        zoneKey,
        rawName,
        file: item.file,
        sequence,
        type: 'audio',
        targetType: 'group',
        targetId: g.id,
        targetLabel: `Q${startQ}–${endQ} Group Audio`,
        currentExists,
        action,
        status: action === 'skip' ? 'skip' : 'ready',
      });
    }
  });

  // Missing sequence calculation
  const missingSequences: number[] = [];
  for (let s = zoneConfig.minSeq; s <= zoneConfig.maxSeq; s++) {
    if (!presentSequences.has(s)) {
      missingSequences.push(s);
    }
  }

  const validMatchedCount = items.filter(i => i.status === 'ready' || i.status === 'skip').length;
  const hasConflict = items.some(i => i.status === 'conflict');
  const hasInvalid = items.some(i => i.status === 'invalid');
  const isComplete = validMatchedCount === zoneConfig.expectedCount;

  let statusCode: ZoneStatus['statusCode'] = 'empty';
  let statusText = 'Chưa chọn file';

  if (items.length > 0) {
    if (hasConflict) {
      statusCode = 'conflict';
      statusText = '⚠ Trùng số thứ tự';
    } else if (hasInvalid) {
      statusCode = 'invalid';
      statusText = '✕ File không hợp lệ';
    } else if (isComplete) {
      statusCode = 'complete';
      statusText = '✓ Hoàn tất';
    } else {
      statusCode = 'incomplete';
      statusText = `⚠ Thiếu ${missingSequences.length}`;
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
    missingSequences,
  };

  return { items, status };
}

// 3. MULTI-ZONE FULL LISTENING PARSER & SUMMARY CALCULATOR
export function mapAllFullListeningZones(
  zoneRawFiles: Record<FullListeningZoneKey, RawMediaFile[]>,
  questions: Array<{ id?: string; question_number: number; part: string; image_url?: string | null; audio_url?: string | null }>,
  groups: Array<{ id?: string; part: string; audio_url?: string | null }>,
  getGroupRange: (groupId: string) => { min: number; max: number },
  isPublished: boolean
): FullListeningParseResult {
  const zoneItems = {} as Record<FullListeningZoneKey, FullListeningMappedItem[]>;
  const zoneStatuses = {} as Record<FullListeningZoneKey, ZoneStatus>;

  FULL_LISTENING_ZONES.forEach(z => {
    const raw = zoneRawFiles[z.key] || [];
    const res = mapFullListeningZone(z.key, raw, questions, groups, getGroupRange, isPublished);
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
  };
}
