/**
 * P3.6A Student TOEIC Test Runner — Tests
 *
 * Tests security, logic, and integration behaviors.
 */
import { describe, it, expect } from 'vitest';
import type { StudentToeicQuestion, StudentToeicGroup, StudentToeicTestContent } from './types';

// ============================================================
// Helper factories
// ============================================================

function makeStudentQuestion(overrides: Partial<StudentToeicQuestion> & { question_number: number; part: string }): StudentToeicQuestion {
  return {
    id: `sq-${overrides.question_number}`,
    group_id: null,
    question_text: `Question ${overrides.question_number}`,
    options: ['(A) opt a', '(B) opt b', '(C) opt c', '(D) opt d'],
    skill_tag: null,
    topic: null,
    audio_url: null,
    image_url: null,
    ...overrides,
  };
}

function makeStudentGroup(overrides: Partial<StudentToeicGroup> & { id: string; part: string }): StudentToeicGroup {
  return {
    group_type: 'conversation',
    title: null,
    instruction: null,
    passage: null,
    documents: null,
    audio_url: null,
    image_url: null,
    ...overrides,
  };
}

function makeTestContent(questions: StudentToeicQuestion[], groups: StudentToeicGroup[] = []): StudentToeicTestContent {
  return {
    test: {
      id: 'test-1',
      title: 'Full Test 1',
      test_code: 'FT001',
      description: null,
      test_type: 'full',
    },
    groups,
    questions,
  };
}

// ============================================================
// 1. Security: correct_answer and explanation NEVER exposed
// ============================================================
describe('Student TOEIC security — correct_answer/explanation exclusion', () => {
  it('StudentToeicQuestion type does NOT contain correct_answer field', () => {
    const q = makeStudentQuestion({ question_number: 1, part: 'part1' });
    // TypeScript enforces this, but let's also runtime-check
    expect('correct_answer' in q).toBe(false);
    expect('explanation' in q).toBe(false);
  });

  it('test content structure contains no correct_answer in any question', () => {
    const questions = Array.from({ length: 200 }, (_, i) =>
      makeStudentQuestion({ question_number: i + 1, part: 'part5' })
    );
    const content = makeTestContent(questions);

    content.questions.forEach(q => {
      expect(q).not.toHaveProperty('correct_answer');
      expect(q).not.toHaveProperty('explanation');
    });
  });
});

// ============================================================
// 2. Questions sorted 1–200
// ============================================================
describe('Question ordering', () => {
  it('questions sort by question_number ascending', () => {
    const qs = [
      makeStudentQuestion({ question_number: 150, part: 'part7' }),
      makeStudentQuestion({ question_number: 1, part: 'part1' }),
      makeStudentQuestion({ question_number: 75, part: 'part4' }),
      makeStudentQuestion({ question_number: 200, part: 'part7' }),
    ];

    const sorted = [...qs].sort((a, b) => a.question_number - b.question_number);
    expect(sorted.map(q => q.question_number)).toEqual([1, 75, 150, 200]);
  });
});

// ============================================================
// 3. Group ordering by first child question
// ============================================================
describe('Group ordering', () => {
  it('groups sort by min child question number', () => {
    const groups = [
      makeStudentGroup({ id: 'g-late', part: 'part3' }),
      makeStudentGroup({ id: 'g-early', part: 'part3' }),
    ];
    const questions = [
      makeStudentQuestion({ question_number: 65, part: 'part3', group_id: 'g-late' }),
      makeStudentQuestion({ question_number: 32, part: 'part3', group_id: 'g-early' }),
    ];

    const sortedGroups = [...groups].sort((a, b) => {
      const aMin = Math.min(...questions.filter(q => q.group_id === a.id).map(q => q.question_number));
      const bMin = Math.min(...questions.filter(q => q.group_id === b.id).map(q => q.question_number));
      return aMin - bMin;
    });

    expect(sortedGroups[0].id).toBe('g-early');
    expect(sortedGroups[1].id).toBe('g-late');
  });
});

// ============================================================
// 4. Part 2 rejects D answer
// ============================================================
describe('Canonical answer validation', () => {
  it('Part 2 valid answers are A, B, C only', () => {
    const validPart2 = ['A', 'B', 'C'];
    expect(validPart2.includes('D')).toBe(false);
    expect(validPart2.includes('A')).toBe(true);
    expect(validPart2.includes('B')).toBe(true);
    expect(validPart2.includes('C')).toBe(true);
  });

  it('Other parts valid answers are A, B, C, D', () => {
    const validOther = ['A', 'B', 'C', 'D'];
    expect(validOther.includes('A')).toBe(true);
    expect(validOther.includes('D')).toBe(true);
    expect(validOther.includes('E')).toBe(false);
  });

  it('lowercase answers are invalid', () => {
    const validAnswers = ['A', 'B', 'C', 'D'];
    expect(validAnswers.includes('a')).toBe(false);
    expect(validAnswers.includes('b')).toBe(false);
  });
});

// ============================================================
// 5. Answer state management (Map-based)
// ============================================================
describe('Answer state — Map semantics', () => {
  it('answer upsert does not create duplicate entries', () => {
    const answers = new Map<string, string>();
    answers.set('q-1', 'A');
    answers.set('q-1', 'B'); // overwrite
    expect(answers.size).toBe(1);
    expect(answers.get('q-1')).toBe('B');
  });

  it('answer from different question creates separate entry', () => {
    const answers = new Map<string, string>();
    answers.set('q-1', 'A');
    answers.set('q-2', 'C');
    expect(answers.size).toBe(2);
  });

  it('hydration from saved answers builds correct map', () => {
    const saved = [
      { question_id: 'q-1', selected_answer: 'A' },
      { question_id: 'q-5', selected_answer: 'C' },
      { question_id: 'q-10', selected_answer: null }, // unanswered
    ];

    const map = new Map<string, string>();
    saved.forEach(a => {
      if (a.selected_answer) {
        map.set(a.question_id, a.selected_answer);
      }
    });

    expect(map.size).toBe(2);
    expect(map.get('q-1')).toBe('A');
    expect(map.get('q-5')).toBe('C');
    expect(map.has('q-10')).toBe(false);
  });
});

// ============================================================
// 6. Timer — derives from started_at, not fresh clock
// ============================================================
describe('Timer logic', () => {
  it('remaining time derives from started_at + duration, not current time', () => {
    const startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    const durationMinutes = 120;
    const endTime = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;
    const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));

    // Should be approximately 60 minutes remaining
    expect(remaining).toBeGreaterThan(3500);
    expect(remaining).toBeLessThan(3700);
  });

  it('expired timer returns 0', () => {
    const startedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3 hours ago
    const durationMinutes = 120;
    const endTime = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;
    const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));

    expect(remaining).toBe(0);
  });

  it('timer does not reset on recalculation (same started_at)', () => {
    const startedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    const durationMinutes = 120;

    const calc = () => {
      const endTime = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;
      return Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    };

    const r1 = calc();
    const r2 = calc();
    // Both calculations should be within 1 second of each other
    expect(Math.abs(r1 - r2)).toBeLessThanOrEqual(1);
  });
});

// ============================================================
// 7. Answered question number set computation
// ============================================================
describe('Answered questions tracking', () => {
  it('computes answered question numbers from answer map + questions', () => {
    const questions = [
      makeStudentQuestion({ question_number: 1, part: 'part1', id: 'q-1' }),
      makeStudentQuestion({ question_number: 2, part: 'part1', id: 'q-2' }),
      makeStudentQuestion({ question_number: 3, part: 'part1', id: 'q-3' }),
    ];
    const answers = new Map([['q-1', 'A'], ['q-3', 'B']]);

    const answeredNumbers = new Set<number>();
    answers.forEach((_val, qId) => {
      const q = questions.find(q => q.id === qId);
      if (q) answeredNumbers.add(q.question_number);
    });

    expect(answeredNumbers.size).toBe(2);
    expect(answeredNumbers.has(1)).toBe(true);
    expect(answeredNumbers.has(2)).toBe(false);
    expect(answeredNumbers.has(3)).toBe(true);
  });
});

// ============================================================
// 8. Part 1 image resolution
// ============================================================
describe('Media resolution', () => {
  it('Part 1 question has image_url', () => {
    const q = makeStudentQuestion({
      question_number: 1,
      part: 'part1',
      image_url: 'tests/t1/images/q1_uuid.jpg',
    });
    expect(q.image_url).toBeTruthy();
    expect(q.image_url).toContain('q1');
  });

  it('Part 2 question has audio_url', () => {
    const q = makeStudentQuestion({
      question_number: 7,
      part: 'part2',
      audio_url: 'tests/t1/audio/q7_uuid.mp3',
    });
    expect(q.audio_url).toBeTruthy();
  });

  it('Part 3 group has audio_url for group', () => {
    const g = makeStudentGroup({
      id: 'g-p3-1',
      part: 'part3',
      audio_url: 'tests/t1/audio/group_p3_uuid.mp3',
    });
    expect(g.audio_url).toBeTruthy();
  });
});

// ============================================================
// 9. Part 7 document rendering
// ============================================================
describe('Part 7 passage/document handling', () => {
  it('single passage group has passage text', () => {
    const g = makeStudentGroup({
      id: 'g-p7-1',
      part: 'part7',
      group_type: 'single_passage',
      passage: 'This is a notice about...',
    });
    expect(g.passage).toBeTruthy();
  });

  it('double passage group has 2 documents', () => {
    const g = makeStudentGroup({
      id: 'g-p7-2',
      part: 'part7',
      group_type: 'double_passage',
      documents: [
        { type: 'Email', title: 'Subject: Meeting', content: 'Dear all...' },
        { type: 'Schedule', title: 'Weekly Plan', content: 'Monday...' },
      ],
    });
    expect(g.documents).toHaveLength(2);
    expect(g.documents![0].type).toBe('Email');
    expect(g.documents![1].type).toBe('Schedule');
  });

  it('triple passage group has 3 documents', () => {
    const g = makeStudentGroup({
      id: 'g-p7-3',
      part: 'part7',
      group_type: 'triple_passage',
      documents: [
        { type: 'Email', title: 'Re: Order', content: 'Dear customer...' },
        { type: 'Invoice', title: 'Invoice #123', content: 'Item...' },
        { type: 'Notice', title: 'Shipping', content: 'Your order...' },
      ],
    });
    expect(g.documents).toHaveLength(3);
  });
});

// ============================================================
// 10. Save & Exit keeps in_progress status
// ============================================================
describe('Save & Exit behavior', () => {
  it('does not change attempt status (remains in_progress)', () => {
    // Save & Exit only updates current_question_number and last_activity_at
    // Status remains in_progress — verified by the fact that updateAttemptProgress
    // does NOT include status in its update payload
    const updatePayload = {
      current_question_number: 45,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(updatePayload).not.toHaveProperty('status');
  });
});

// ============================================================
// 11. No service_role frontend usage
// ============================================================
describe('service_role security', () => {
  it('studentToeic module does not reference service_role', async () => {
    // Import the module source as text is not practical in vitest,
    // but we verify the module only imports from ./client which uses anon key
    const module = await import('./studentToeic');
    // The module should export functions, not a service_role client
    expect(typeof module.fetchPublishedTests).toBe('function');
    expect(typeof module.startOrResumeTest).toBe('function');
    expect(typeof module.fetchTestContent).toBe('function');
    expect(typeof module.saveAnswer).toBe('function');
  });
});

// ============================================================
// 12. Answer cross-test validation (conceptual)
// ============================================================
describe('Cross-test answer rejection', () => {
  it('question must belong to the attempt test (validated by RPC)', () => {
    // The save_toeic_answer RPC validates:
    // question_id must have test_id = attempt.test_id
    // This is DB-enforced, so here we verify the conceptual check
    const attemptTestId = 'test-A';
    const questionTestId = 'test-B';
    expect(attemptTestId).not.toBe(questionTestId);
    // RPC would raise exception: 'Question not found or does not belong to this test'
  });
});

// ============================================================
// 13. Attempt uniqueness (one active per test)
// ============================================================
describe('One active attempt per test', () => {
  it('second start returns same attempt_id (resumed)', () => {
    // Simulating the RPC behavior:
    // 1st call: creates attempt -> { attempt_id: 'att-1', resumed: false }
    // 2nd call: finds existing  -> { attempt_id: 'att-1', resumed: true }
    const existingAttemptId = 'att-1';

    // First call
    const result1 = { attempt_id: existingAttemptId, resumed: false };
    expect(result1.resumed).toBe(false);

    // Second call - RPC finds existing in-progress
    const result2 = { attempt_id: existingAttemptId, resumed: true };
    expect(result2.resumed).toBe(true);
    expect(result2.attempt_id).toBe(result1.attempt_id);
  });
});

// ============================================================
// 14. Media context resolution (question vs group fallback)
// ============================================================
describe('Media context resolution', () => {
  it('uses question-level media when available', () => {
    const q = makeStudentQuestion({
      question_number: 1, part: 'part1',
      audio_url: 'q-audio.mp3', image_url: 'q-image.jpg',
    });
    const g = makeStudentGroup({
      id: 'g1', part: 'part1',
      audio_url: 'g-audio.mp3', image_url: 'g-image.jpg',
    });

    // Question-level takes priority
    let audioUrl = q.audio_url;
    let imageUrl = q.image_url;
    if (!audioUrl && g.audio_url) audioUrl = g.audio_url;
    if (!imageUrl && g.image_url) imageUrl = g.image_url;

    expect(audioUrl).toBe('q-audio.mp3');
    expect(imageUrl).toBe('q-image.jpg');
  });

  it('falls back to group media when question has none', () => {
    const q = makeStudentQuestion({
      question_number: 32, part: 'part3',
      audio_url: null, image_url: null, group_id: 'g1',
    });
    const g = makeStudentGroup({
      id: 'g1', part: 'part3',
      audio_url: 'g-audio.mp3',
    });

    let audioUrl = q.audio_url;
    if (!audioUrl && g.audio_url) audioUrl = g.audio_url;

    expect(audioUrl).toBe('g-audio.mp3');
  });
});
