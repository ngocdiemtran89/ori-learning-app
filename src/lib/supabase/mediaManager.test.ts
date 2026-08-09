import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadQuestionMedia, removeQuestionMedia, uploadGroupMedia, removeGroupMedia } from './adminTestBank';
import { uploadToeicMedia, deleteToeicMedia } from './storage';

// 1. Setup a flexible mock for the Supabase query builder
const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  update: vi.fn().mockReturnThis(),
  // For update().eq() chains which are directly awaited
  then: vi.fn((resolve) => resolve({ data: null, error: null })),
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

describe('Media Manager (adminTestBank.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock returns
    mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
    
    // reset 'then' implementation to default successful resolve
    mockQueryBuilder.then = vi.fn((resolve) => resolve({ data: null, error: null }));
  });

  describe('uploadQuestionMedia', () => {
    it('uploads to storage and updates DB successfully', async () => {
      // Mock get existing question
      mockQueryBuilder.single.mockResolvedValueOnce({ data: { image_url: 'old/path.png' }, error: null });
      
      // Mock storage upload
      (uploadToeicMedia as any).mockResolvedValue({ success: true, path: 'new/path.png' });
      (deleteToeicMedia as any).mockResolvedValue({ success: true });

      const file = new File([''], 'test.png', { type: 'image/png' });
      const res = await uploadQuestionMedia('test1', 'q1', 5, 'part1', file, 'image');

      expect(uploadToeicMedia).toHaveBeenCalled();
      expect(deleteToeicMedia).toHaveBeenCalledWith('old/path.png');
      expect(res.success).toBe(true);
    });

    it('returns error if storage upload fails', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: { image_url: 'old/path.png' }, error: null });
      (uploadToeicMedia as any).mockResolvedValue({ success: false, error: 'Upload fail' });
      
      const file = new File([''], 'test.png', { type: 'image/png' });
      const res = await uploadQuestionMedia('test1', 'q1', 5, 'part1', file, 'image');

      expect(res.success).toBe(false);
      expect(res.error).toBe('Upload fail');
      expect(mockQueryBuilder.update).not.toHaveBeenCalled(); 
    });
  });

  describe('removeQuestionMedia', () => {
    it('updates DB to null and removes from storage', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: { image_url: 'old/path.png' }, error: null });
      (deleteToeicMedia as any).mockResolvedValue({ success: true });

      const res = await removeQuestionMedia('q1', 'image');

      expect(res.success).toBe(true);
      expect(deleteToeicMedia).toHaveBeenCalledWith('old/path.png');
    });
  });

  describe('uploadGroupMedia', () => {
    it('uploads to storage and updates group DB successfully', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: { audio_url: 'old-group/audio.mp3' }, error: null });
      (uploadToeicMedia as any).mockResolvedValue({ success: true, path: 'new-group-audio.mp3' });
      (deleteToeicMedia as any).mockResolvedValue({ success: true });

      const file = new File([''], 'audio.mp3', { type: 'audio/mp3' });
      const res = await uploadGroupMedia('test1', 'g1', 'part3', file, 'audio');

      expect(uploadToeicMedia).toHaveBeenCalled();
      expect(deleteToeicMedia).toHaveBeenCalledWith('old-group/audio.mp3');
      expect(res.success).toBe(true);
    });
  });

  describe('removeGroupMedia', () => {
    it('updates DB to null and removes group media from storage', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: { audio_url: 'old-group/audio.mp3' }, error: null });
      (deleteToeicMedia as any).mockResolvedValue({ success: true });

      const res = await removeGroupMedia('g1', 'audio');

      expect(res.success).toBe(true);
      expect(deleteToeicMedia).toHaveBeenCalledWith('old-group/audio.mp3');
    });
  });
});
