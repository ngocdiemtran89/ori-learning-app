import { describe, it, expect, vi } from 'vitest';
import {
  createToeicListeningTemplate,
  validateSegments,
  exportSegments,
  importSegments,
  playSegment,
  formatTimecode,
  getSegmentStatus,
  ToeicAudioSegment,
} from './toeicAudioCutter';

describe('TOEIC Audio Cutter Core Engine Suite', () => {
  it('1. TOEIC template creates Q1–100 exactly once with 54 total segments', () => {
    const segments = createToeicListeningTemplate();
    expect(segments).toHaveLength(54);

    const questionsMap = new Set<number>();
    segments.forEach((seg) => {
      for (let q = seg.startQuestion; q <= seg.endQuestion; q++) {
        expect(questionsMap.has(q)).toBe(false);
        questionsMap.add(q);
      }
    });

    expect(questionsMap.size).toBe(100);
    expect(Math.min(...Array.from(questionsMap))).toBe(1);
    expect(Math.max(...Array.from(questionsMap))).toBe(100);
  });

  it('2. P1 = Q1–6 individual (6 segments)', () => {
    const segments = createToeicListeningTemplate();
    const p1 = segments.filter((s) => s.part === 1);
    expect(p1).toHaveLength(6);
    expect(p1[0]).toMatchObject({ part: 1, startQuestion: 1, endQuestion: 1 });
    expect(p1[5]).toMatchObject({ part: 1, startQuestion: 6, endQuestion: 6 });
  });

  it('3. P2 = Q7–31 individual (25 segments)', () => {
    const segments = createToeicListeningTemplate();
    const p2 = segments.filter((s) => s.part === 2);
    expect(p2).toHaveLength(25);
    expect(p2[0]).toMatchObject({ part: 2, startQuestion: 7, endQuestion: 7 });
    expect(p2[24]).toMatchObject({ part: 2, startQuestion: 31, endQuestion: 31 });
  });

  it('4. P3 = 13 groups of 3 questions', () => {
    const segments = createToeicListeningTemplate();
    const p3 = segments.filter((s) => s.part === 3);
    expect(p3).toHaveLength(13);
    p3.forEach((seg) => {
      expect(seg.endQuestion - seg.startQuestion + 1).toBe(3);
    });
  });

  it('5. P4 = 10 groups of 3 questions', () => {
    const segments = createToeicListeningTemplate();
    const p4 = segments.filter((s) => s.part === 4);
    expect(p4).toHaveLength(10);
    p4.forEach((seg) => {
      expect(seg.endQuestion - seg.startQuestion + 1).toBe(3);
    });
  });

  it('6. Q32–34 correct boundary in Part 3', () => {
    const segments = createToeicListeningTemplate();
    const q32_34 = segments.find((s) => s.startQuestion === 32);
    expect(q32_34).toBeDefined();
    expect(q32_34).toMatchObject({
      part: 3,
      startQuestion: 32,
      endQuestion: 34,
      label: 'Part 3 — Câu 32–34',
    });
  });

  it('7. Q68–70 correct boundary at end of Part 3', () => {
    const segments = createToeicListeningTemplate();
    const q68_70 = segments.find((s) => s.startQuestion === 68);
    expect(q68_70).toBeDefined();
    expect(q68_70).toMatchObject({
      part: 3,
      startQuestion: 68,
      endQuestion: 70,
      label: 'Part 3 — Câu 68–70',
    });
  });

  it('8. Q71–73 correct boundary at start of Part 4', () => {
    const segments = createToeicListeningTemplate();
    const q71_73 = segments.find((s) => s.startQuestion === 71);
    expect(q71_73).toBeDefined();
    expect(q71_73).toMatchObject({
      part: 4,
      startQuestion: 71,
      endQuestion: 73,
      label: 'Part 4 — Câu 71–73',
    });
  });

  it('9. Q98–100 correct boundary at end of Part 4', () => {
    const segments = createToeicListeningTemplate();
    const q98_100 = segments.find((s) => s.startQuestion === 98);
    expect(q98_100).toBeDefined();
    expect(q98_100).toMatchObject({
      part: 4,
      startQuestion: 98,
      endQuestion: 100,
      label: 'Part 4 — Câu 98–100',
    });
  });

  it('10. invalid end <= start is rejected by validateSegments', () => {
    const invalidSegments: ToeicAudioSegment[] = [
      {
        id: 's1',
        part: 1,
        startQuestion: 1,
        endQuestion: 1,
        label: 'P1 Q1',
        startSeconds: 10.5,
        endSeconds: 10.0, // invalid: end <= start
      },
    ];

    const result = validateSegments(invalidSegments);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('phải lớn hơn'))).toBe(true);
  });

  it('11. overlapping question ownership is rejected by validateSegments', () => {
    const overlappingSegments: ToeicAudioSegment[] = [
      {
        id: 's1',
        part: 1,
        startQuestion: 1,
        endQuestion: 3,
        label: 'P1 Q1-3',
        startSeconds: 0,
        endSeconds: 10,
      },
      {
        id: 's2',
        part: 1,
        startQuestion: 3, // Q3 is duplicated!
        endQuestion: 5,
        label: 'P1 Q3-5',
        startSeconds: 10,
        endSeconds: 20,
      },
    ];

    const result = validateSegments(overlappingSegments);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('trùng lặp chủ sở hữu'))).toBe(true);
  });

  it('12. import/export JSON roundtrip preserves all segments accurately', () => {
    const originalTemplate = createToeicListeningTemplate();

    // Fill dummy valid timestamps
    originalTemplate[0].startSeconds = 12.5;
    originalTemplate[0].endSeconds = 25.0;

    const exportedJson = exportSegments('test-audio.mp3', 3000, originalTemplate);
    expect(exportedJson).toContain('test-audio.mp3');

    const imported = importSegments(exportedJson);
    expect(imported.success).toBe(true);
    expect(imported.data?.audioFileName).toBe('test-audio.mp3');
    expect(imported.data?.segments).toHaveLength(54);
    expect(imported.data?.segments[0].startSeconds).toBe(12.5);
    expect(imported.data?.segments[0].endSeconds).toBe(25.0);
  });

  it('13. playSegment sets currentTime and pauses audio when endSeconds reached', () => {
    const listeners: Record<string, Function[]> = {};

    const mockAudio = {
      currentTime: 0,
      play: vi.fn().mockImplementation(() => Promise.resolve()),
      pause: vi.fn(),
      addEventListener: vi.fn().mockImplementation((event, cb) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      }),
      removeEventListener: vi.fn().mockImplementation((event, cb) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((fn) => fn !== cb);
        }
      }),
    } as unknown as HTMLAudioElement;

    const segment: ToeicAudioSegment = {
      id: 'seg-test',
      part: 3,
      startQuestion: 32,
      endQuestion: 34,
      label: 'Q32-34',
      startSeconds: 10.0,
      endSeconds: 15.0,
    };

    const onEnd = vi.fn();
    const cleanup = playSegment(mockAudio, segment, onEnd);

    expect(mockAudio.currentTime).toBe(10.0);
    expect(mockAudio.play).toHaveBeenCalled();

    // Trigger timeupdate BEFORE endSeconds
    mockAudio.currentTime = 12.0;
    listeners['timeupdate']?.forEach((cb) => cb());
    expect(mockAudio.pause).not.toHaveBeenCalled();

    // Trigger timeupdate AT or AFTER endSeconds
    mockAudio.currentTime = 15.1;
    listeners['timeupdate']?.forEach((cb) => cb());
    expect(mockAudio.pause).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalled();

    cleanup();
  });

  it('14. formatTimecode correctly formats seconds to MM:SS.ms string', () => {
    expect(formatTimecode(0)).toBe('00:00.000');
    expect(formatTimecode(74.25)).toBe('01:14.250');
    expect(formatTimecode(3661.123)).toBe('61:01.123');
  });

  it('15. getSegmentStatus detects UNSET, ERROR, and SET states', () => {
    const unsetSeg: ToeicAudioSegment = { id: '1', part: 1, startQuestion: 1, endQuestion: 1, label: 'L', startSeconds: 0, endSeconds: 0 };
    expect(getSegmentStatus(unsetSeg)).toBe('UNSET');

    const errSeg: ToeicAudioSegment = { id: '2', part: 1, startQuestion: 1, endQuestion: 1, label: 'L', startSeconds: 10, endSeconds: 5 };
    expect(getSegmentStatus(errSeg)).toBe('ERROR');

    const setSeg: ToeicAudioSegment = { id: '3', part: 1, startQuestion: 1, endQuestion: 1, label: 'L', startSeconds: 5, endSeconds: 10 };
    expect(getSegmentStatus(setSeg)).toBe('SET');
  });
});
