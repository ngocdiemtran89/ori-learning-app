import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importToeicTestDraft } from './adminToeicClassifier';
import { supabase } from './client';
import { ParsedToeicTestDraft } from '../toeic/classifier/types';

vi.mock('./client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    rpc: vi.fn()
  }
}));

describe('adminToeicClassifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getValidDraft = (): ParsedToeicTestDraft => ({
    metadata: {
      title: 'Test',
      slug: 'test-1',
      test_code: 'T1',
      description: null,
      test_type: 'full'
    },
    groups: [
      {
        group_temp_key: 'g1',
        part: 'part1',
        group_type: 'photo',
        title: null,
        instruction: null,
        passage: null,
        transcript: null,
        audio_url: null,
        image_url: null,
        documents: []
      }
    ],
    questions: [
      {
        question_number: 1,
        part: 'part1',
        question_text: null,
        options: ['(A) a', '(B) b'],
        correct_answer: 'A',
        explanation: null,
        group_temp_key: 'g1',
        audio_url: null,
        image_url: null
      }
    ]
  });

  it('CASE: valid grouped import -> succeeds', async () => {
    vi.mocked(supabase.maybeSingle).mockResolvedValue({ data: null, error: null } as any);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true, test_id: 'test-uuid' }, error: null } as any);

    const draft = getValidDraft();
    const result = await importToeicTestDraft(draft);

    expect(result.success).toBe(true);
    expect(result.testId).toBe('test-uuid');
  });

  it('CASE: duplicate group_temp_key -> rejected (conceptually by DB)', async () => {
    vi.mocked(supabase.maybeSingle).mockResolvedValue({ data: null, error: null } as any);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'Duplicate group_temp_key: g1' } } as any);

    const draft = getValidDraft();
    const result = await importToeicTestDraft(draft);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Duplicate group_temp_key');
  });

  it('CASE: question/group Part mismatch -> rejected (conceptually by DB)', async () => {
    vi.mocked(supabase.maybeSingle).mockResolvedValue({ data: null, error: null } as any);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'Question part (part2) does not match group part (part1)' } } as any);

    const draft = getValidDraft();
    const result = await importToeicTestDraft(draft);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Question part (part2) does not match');
  });

  it('CASE: standalone Part 5 without group -> accepted (conceptually by DB)', async () => {
    vi.mocked(supabase.maybeSingle).mockResolvedValue({ data: null, error: null } as any);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { success: true, test_id: 'test-uuid' }, error: null } as any);

    const draft = getValidDraft();
    draft.groups = [];
    draft.questions = [
      {
        question_number: 101,
        part: 'part5',
        question_text: 'Text',
        options: ['(A) a', '(B) b'],
        correct_answer: 'A',
        explanation: null,
        group_temp_key: null,
        audio_url: null,
        image_url: null
      }
    ];
    const result = await importToeicTestDraft(draft);

    expect(result.success).toBe(true);
  });
});
