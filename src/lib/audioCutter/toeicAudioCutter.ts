/**
 * TOEIC Listening Audio Cutter Core Logic & Utilities (v1 Frontend-Only)
 * Handles template creation, timestamp validation, import/export, local autosave, and playback control.
 */

export type ToeicAudioSegment = {
  id: string;
  part: 1 | 2 | 3 | 4;
  startQuestion: number;
  endQuestion: number;
  label: string;
  startSeconds: number;
  endSeconds: number;
};

export type ToeicAudioExportFormat = {
  version: 1;
  audioFileName: string;
  duration: number;
  segments: ToeicAudioSegment[];
};

export type SegmentValidationStatus = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

export type SegmentItemStatus = 'UNSET' | 'SET' | 'ERROR';

/**
 * Creates the standard 100-question TOEIC Listening segment template (54 total segments).
 * Part 1 (Q1-6): 6 individual 1-question segments
 * Part 2 (Q7-31): 25 individual 1-question segments
 * Part 3 (Q32-70): 13 groups of 3 questions
 * Part 4 (Q71-100): 10 groups of 3 questions
 */
export function createToeicListeningTemplate(): ToeicAudioSegment[] {
  const segments: ToeicAudioSegment[] = [];

  // Part 1: Q1 -> Q6 (6 individual)
  for (let q = 1; q <= 6; q++) {
    segments.push({
      id: `p1-q${q}`,
      part: 1,
      startQuestion: q,
      endQuestion: q,
      label: `Part 1 — Câu ${q}`,
      startSeconds: 0,
      endSeconds: 0,
    });
  }

  // Part 2: Q7 -> Q31 (25 individual)
  for (let q = 7; q <= 31; q++) {
    segments.push({
      id: `p2-q${q}`,
      part: 2,
      startQuestion: q,
      endQuestion: q,
      label: `Part 2 — Câu ${q}`,
      startSeconds: 0,
      endSeconds: 0,
    });
  }

  // Part 3: Q32 -> Q70 (13 groups of 3 questions)
  for (let q = 32; q <= 70; q += 3) {
    const endQ = q + 2;
    segments.push({
      id: `p3-q${q}-${endQ}`,
      part: 3,
      startQuestion: q,
      endQuestion: endQ,
      label: `Part 3 — Câu ${q}–${endQ}`,
      startSeconds: 0,
      endSeconds: 0,
    });
  }

  // Part 4: Q71 -> Q100 (10 groups of 3 questions)
  for (let q = 71; q <= 100; q += 3) {
    const endQ = q + 2;
    segments.push({
      id: `p4-q${q}-${endQ}`,
      part: 4,
      startQuestion: q,
      endQuestion: endQ,
      label: `Part 4 — Câu ${q}–${endQ}`,
      startSeconds: 0,
      endSeconds: 0,
    });
  }

  return segments;
}

/**
 * Validates TOEIC Audio Segments
 */
export function validateSegments(
  segments: ToeicAudioSegment[],
  duration?: number
): SegmentValidationStatus {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(segments) || segments.length === 0) {
    errors.push('Danh sách phân đoạn rỗng.');
    return { isValid: false, errors, warnings };
  }

  const questionOwnershipMap = new Map<number, string>();

  segments.forEach((seg, index) => {
    const prefix = `Phân đoạn #${index + 1} (${seg.label || 'Không tên'})`;

    // Part & Question range boundary validation
    if (![1, 2, 3, 4].includes(seg.part)) {
      errors.push(`${prefix}: Part không hợp lệ (${seg.part}). Phải là 1, 2, 3 hoặc 4.`);
    }

    if (seg.startQuestion > seg.endQuestion) {
      errors.push(`${prefix}: Câu bắt đầu (Q${seg.startQuestion}) lớn hơn câu kết thúc (Q${seg.endQuestion}).`);
    }

    // Part-specific question bounds
    if (seg.part === 1 && (seg.startQuestion < 1 || seg.endQuestion > 6)) {
      errors.push(`${prefix}: Part 1 phải nằm trong phạm vi Q1–Q6.`);
    }
    if (seg.part === 2 && (seg.startQuestion < 7 || seg.endQuestion > 31)) {
      errors.push(`${prefix}: Part 2 phải nằm trong phạm vi Q7–Q31.`);
    }
    if (seg.part === 3 && (seg.startQuestion < 32 || seg.endQuestion > 70)) {
      errors.push(`${prefix}: Part 3 phải nằm trong phạm vi Q32–Q70.`);
    }
    if (seg.part === 4 && (seg.startQuestion < 71 || seg.endQuestion > 100)) {
      errors.push(`${prefix}: Part 4 phải nằm trong phạm vi Q71–Q100.`);
    }

    // Duplicate question ownership check
    for (let q = seg.startQuestion; q <= seg.endQuestion; q++) {
      if (questionOwnershipMap.has(q)) {
        errors.push(`${prefix}: Câu Q${q} bị trùng lặp chủ sở hữu (đã thuộc phân đoạn ${questionOwnershipMap.get(q)}).`);
      } else {
        questionOwnershipMap.set(q, seg.label || `ID:${seg.id}`);
      }
    }

    // Timestamp logic validation
    if (seg.startSeconds < 0) {
      errors.push(`${prefix}: Thời gian bắt đầu (${seg.startSeconds}s) âm.`);
    }

    // If timestamp is configured (non-zero or start != end)
    if (seg.endSeconds > 0 || seg.startSeconds > 0) {
      if (seg.endSeconds <= seg.startSeconds) {
        errors.push(`${prefix}: Thời gian kết thúc (${seg.endSeconds}s) phải lớn hơn thời gian bắt đầu (${seg.startSeconds}s).`);
      }
      if (duration && duration > 0 && seg.endSeconds > duration) {
        errors.push(`${prefix}: Thời gian kết thúc (${seg.endSeconds}s) vượt quá tổng thời lượng audio (${duration}s).`);
      }
    }
  });

  // Check 100 question coverage warning if template format
  const coveredQuestions = Array.from(questionOwnershipMap.keys()).sort((a, b) => a - b);
  if (coveredQuestions.length > 0 && coveredQuestions.length < 100) {
    warnings.push(`Bộ phân đoạn mới bao phủ ${coveredQuestions.length}/100 câu TOEIC Listening.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Computes individual status of a segment item
 */
export function getSegmentStatus(segment: ToeicAudioSegment, duration?: number): SegmentItemStatus {
  if (segment.startSeconds === 0 && segment.endSeconds === 0) {
    return 'UNSET';
  }
  if (
    segment.startSeconds < 0 ||
    segment.endSeconds <= segment.startSeconds ||
    (duration && duration > 0 && segment.endSeconds > duration)
  ) {
    return 'ERROR';
  }
  return 'SET';
}

/**
 * Formats time in seconds to MM:SS.ms string format (e.g. 01:23.450)
 */
export function formatTimecode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.000';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const minsStr = mins.toString().padStart(2, '0');
  const secsStr = secs.toString().padStart(2, '0');
  const msStr = ms.toString().padStart(3, '0');

  return `${minsStr}:${secsStr}.${msStr}`;
}

/**
 * Exports segments to formatted JSON string
 */
export function exportSegments(
  audioFileName: string,
  duration: number,
  segments: ToeicAudioSegment[]
): string {
  const exportData: ToeicAudioExportFormat = {
    version: 1,
    audioFileName: audioFileName || 'toeic-listening.mp3',
    duration: Math.round((duration || 0) * 1000) / 1000,
    segments: segments.map((s) => ({
      id: s.id,
      part: s.part,
      startQuestion: s.startQuestion,
      endQuestion: s.endQuestion,
      label: s.label,
      startSeconds: Math.round(s.startSeconds * 1000) / 1000,
      endSeconds: Math.round(s.endSeconds * 1000) / 1000,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Imports segments from JSON string and validates structure
 */
export function importSegments(
  jsonString: string,
  currentDuration?: number
): { success: boolean; data?: ToeicAudioExportFormat; errors: string[] } {
  try {
    const parsed = JSON.parse(jsonString);

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, errors: ['File JSON không hợp lệ.'] };
    }

    if (parsed.version !== 1) {
      return { success: false, errors: [`Version JSON không hỗ trợ: ${parsed.version}. Cần version: 1.`] };
    }

    if (!Array.isArray(parsed.segments)) {
      return { success: false, errors: ['Thuộc tính "segments" phải là một mảng.'] };
    }

    const segments: ToeicAudioSegment[] = parsed.segments.map((s: any, idx: number) => ({
      id: String(s.id || `seg-${idx + 1}`),
      part: Number(s.part) as 1 | 2 | 3 | 4,
      startQuestion: Number(s.startQuestion || 0),
      endQuestion: Number(s.endQuestion || 0),
      label: String(s.label || `Phân đoạn ${idx + 1}`),
      startSeconds: Number(s.startSeconds || 0),
      endSeconds: Number(s.endSeconds || 0),
    }));

    const val = validateSegments(segments, currentDuration || parsed.duration);

    if (!val.isValid) {
      return { success: false, errors: val.errors };
    }

    const exportData: ToeicAudioExportFormat = {
      version: 1,
      audioFileName: String(parsed.audioFileName || 'toeic-listening.mp3'),
      duration: Number(parsed.duration || currentDuration || 0),
      segments,
    };

    return { success: true, data: exportData, errors: [] };
  } catch (err: any) {
    return { success: false, errors: [`Lỗi parse JSON: ${err?.message || err}`] };
  }
}

/**
 * Plays a segment on an HTMLAudioElement and automatically pauses at endSeconds.
 * Returns a cleanup function to unbind event listeners.
 */
export function playSegment(
  audio: HTMLAudioElement,
  segment: ToeicAudioSegment,
  onEnd?: () => void
): () => void {
  if (!audio) return () => {};

  audio.currentTime = segment.startSeconds;

  const handleTimeUpdate = () => {
    if (audio.currentTime >= segment.endSeconds) {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      if (onEnd) onEnd();
    }
  };

  audio.addEventListener('timeupdate', handleTimeUpdate);

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch((err) => {
      console.warn('Audio play interrupted or prevented:', err);
    });
  }

  return () => {
    audio.removeEventListener('timeupdate', handleTimeUpdate);
  };
}

/**
 * Local Storage Draft Helpers
 */
export function getDraftStorageKey(audioFileName: string): string {
  const cleanName = audioFileName ? audioFileName.trim() : 'default';
  return `ori:toeic-audio-cutter:${cleanName}`;
}

export function saveLocalDraft(audioFileName: string, segments: ToeicAudioSegment[]): void {
  try {
    const key = getDraftStorageKey(audioFileName);
    localStorage.setItem(key, JSON.stringify(segments));
  } catch (e) {
    console.error('Failed to save local audio cutter draft:', e);
  }
}

export function loadLocalDraft(audioFileName: string): ToeicAudioSegment[] | null {
  try {
    const key = getDraftStorageKey(audioFileName);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load local audio cutter draft:', e);
  }
  return null;
}

export function clearLocalDraft(audioFileName: string): void {
  try {
    const key = getDraftStorageKey(audioFileName);
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Failed to clear local audio cutter draft:', e);
  }
}
