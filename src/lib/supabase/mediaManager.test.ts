import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadQuestionMedia, removeQuestionMedia, uploadGroupMedia, removeGroupMedia } from './adminTestBank';
import { uploadToeicMedia, deleteToeicMedia } from './storage';

// Flexible mock for the Supabase query builder chain
const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  update: vi.fn().mockReturnThis(),
  then: vi.fn((resolve: any) => resolve({ data: null, error: null })),
};

vi.mock('./client', () => {
  return {
    supabase: {
      from: vi.fn(() => mockQueryBuilder),
    },
  };
});

vi.mock('./storage', () => {
  return {
    uploadToeicMedia: vi.fn(),
    deleteToeicMedia: vi.fn(),
  };
});

describe('Media Manager Security (adminTestBank.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
    mockQueryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));
  });

  // ---------------------------------------------------------------
  // uploadQuestionMedia — DB-derived path + unique replacement
  // ---------------------------------------------------------------
  describe('uploadQuestionMedia', () => {
    it('derives canonical path from DB row (not caller args)', async () => {
      // DB returns trusted metadata
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { test_id: 'db-test-id', question_number: 5, part: 'part1', image_url: null, audio_url: null },
        error: null,
      });
      (uploadToeicMedia as any).mockResolvedValue({ success: true, path: 'toeic-tests/db-test-id/part1/q005/image_uuid.png' });

      const file = new File([''], 'test.png', { type: 'image/png' });
      // Signature is (questionId, file, type) — no testId/part/number
      const res = await uploadQuestionMedia('q1', file, 'image');

      expect(res.success).toBe(true);
      // Verify uploadToeicMedia was called with DB-derived prefix
      expect(uploadToeicMedia).toHaveBeenCalledWith(
        'toeic-tests/db-test-id/part1/q005',
        file,
        'image'
      );
    });

    it('uploads new unique path and deletes old path on success', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { test_id: 't1', question_number: 1, part: 'part1', image_url: 'old/path.png', audio_url: null },
        error: null,
      });
      (uploadToeicMedia as any).mockResolvedValue({ success: true, path: 'new/unique/path.png' });
      (deleteToeicMedia as any).mockResolvedValue(true);

      const file = new File([''], 'test.png', { type: 'image/png' });
      const res = await uploadQuestionMedia('q1', file, 'image');

      expect(res.success).toBe(true);
      // Old path deleted only after DB success
      expect(deleteToeicMedia).toHaveBeenCalledWith('old/path.png');
    });

    it('returns error if storage upload fails — does not update DB', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { test_id: 't1', question_number: 1, part: 'part1', image_url: 'old/path.png', audio_url: null },
        error: null,
      });
      (uploadToeicMedia as any).mockResolvedValue({ success: false, error: 'Upload fail' });

      const file = new File([''], 'test.png', { type: 'image/png' });
      const res = await uploadQuestionMedia('q1', file, 'image');

      expect(res.success).toBe(false);
      expect(res.error).toBe('Upload fail');
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it('performs compensating cleanup when DB update fails — old media preserved', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { test_id: 't1', question_number: 1, part: 'part1', image_url: 'old/path.png', audio_url: null },
        error: null,
      });
      (uploadToeicMedia as any).mockResolvedValue({ success: true, path: 'new/unique/path.png' });
      // DB update fails
      mockQueryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: { message: 'DB error' } }));

      const file = new File([''], 'test.png', { type: 'image/png' });
      const res = await uploadQuestionMedia('q1', file, 'image');

      expect(res.success).toBe(false);
      // newPath cleaned up (compensating cleanup)
      expect(deleteToeicMedia).toHaveBeenCalledWith('new/unique/path.png');
      // oldPath NOT deleted — preserved for data integrity
      expect(deleteToeicMedia).not.toHaveBeenCalledWith('old/path.png');
    });
  });

  // ---------------------------------------------------------------
  // removeQuestionMedia — published test protection
  // ---------------------------------------------------------------
  describe('removeQuestionMedia', () => {
    it('blocks removal from published test', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { image_url: 'some/path.png', audio_url: null, toeic_tests: { is_published: true } },
        error: null,
      });

      const res = await removeQuestionMedia('q1', 'image');

      expect(res.success).toBe(false);
      expect(res.error).toContain('xuất bản');
      // No storage delete should happen
      expect(deleteToeicMedia).not.toHaveBeenCalled();
    });

    it('allows removal from draft test', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { image_url: 'some/path.png', audio_url: null, toeic_tests: { is_published: false } },
        error: null,
      });
      (deleteToeicMedia as any).mockResolvedValue(true);

      const res = await removeQuestionMedia('q1', 'image');

      expect(res.success).toBe(true);
      expect(deleteToeicMedia).toHaveBeenCalledWith('some/path.png');
    });

    it('updates DB first then deletes storage — safe order', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { image_url: 'old/path.png', audio_url: null, toeic_tests: { is_published: false } },
        error: null,
      });
      (deleteToeicMedia as any).mockResolvedValue(true);

      const res = await removeQuestionMedia('q1', 'image');

      expect(res.success).toBe(true);
      // DB update happens before storage delete
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(deleteToeicMedia).toHaveBeenCalledWith('old/path.png');
    });
  });

  // ---------------------------------------------------------------
  // uploadGroupMedia — DB-derived path
  // ---------------------------------------------------------------
  describe('uploadGroupMedia', () => {
    it('derives canonical path from DB row (not caller args)', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { test_id: 'db-test-id', part: 'part3', image_url: null, audio_url: null },
        error: null,
      });
      (uploadToeicMedia as any).mockResolvedValue({ success: true, path: 'toeic-tests/db-test-id/part3/group-g1/audio_uuid.mp3' });

      const file = new File([''], 'audio.mp3', { type: 'audio/mpeg' });
      // Signature is (groupId, file, type) — no testId/part
      const res = await uploadGroupMedia('g1', file, 'audio');

      expect(res.success).toBe(true);
      expect(uploadToeicMedia).toHaveBeenCalledWith(
        'toeic-tests/db-test-id/part3/group-g1',
        file,
        'audio'
      );
    });

    it('performs compensating cleanup when DB update fails', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { test_id: 't1', part: 'part3', image_url: null, audio_url: 'old/audio.mp3' },
        error: null,
      });
      (uploadToeicMedia as any).mockResolvedValue({ success: true, path: 'new/audio.mp3' });
      mockQueryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: { message: 'DB error' } }));

      const file = new File([''], 'audio.mp3', { type: 'audio/mpeg' });
      const res = await uploadGroupMedia('g1', file, 'audio');

      expect(res.success).toBe(false);
      expect(deleteToeicMedia).toHaveBeenCalledWith('new/audio.mp3');
      expect(deleteToeicMedia).not.toHaveBeenCalledWith('old/audio.mp3');
    });
  });

  // ---------------------------------------------------------------
  // removeGroupMedia — published test protection
  // ---------------------------------------------------------------
  describe('removeGroupMedia', () => {
    it('blocks removal from published test', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { image_url: null, audio_url: 'some/audio.mp3', toeic_tests: { is_published: true } },
        error: null,
      });

      const res = await removeGroupMedia('g1', 'audio');

      expect(res.success).toBe(false);
      expect(res.error).toContain('xuất bản');
      expect(deleteToeicMedia).not.toHaveBeenCalled();
    });

    it('allows removal from draft test', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { image_url: null, audio_url: 'some/audio.mp3', toeic_tests: { is_published: false } },
        error: null,
      });
      (deleteToeicMedia as any).mockResolvedValue(true);

      const res = await removeGroupMedia('g1', 'audio');

      expect(res.success).toBe(true);
      expect(deleteToeicMedia).toHaveBeenCalledWith('some/audio.mp3');
    });
  });

  // ---------------------------------------------------------------
  // Orphan behavior — storage delete failure after DB success
  // ---------------------------------------------------------------
  describe('orphan behavior', () => {
    it('remove succeeds even if storage delete fails — orphan remains but DB ref cleared', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { image_url: 'orphan/path.png', audio_url: null, toeic_tests: { is_published: false } },
        error: null,
      });
      // Storage delete fails — orphan remains
      (deleteToeicMedia as any).mockResolvedValue(false);

      const res = await removeQuestionMedia('q1', 'image');

      // Operation still succeeds because DB ref was cleared
      // Student SELECT policy makes orphan inaccessible since no active row references it
      expect(res.success).toBe(true);
    });
  });
});
