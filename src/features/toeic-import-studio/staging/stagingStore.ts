/**
 * Frontend Staging Store & Local Draft Persistence
 */

import { StagingQuestion, StagingGroup, AudioSegment } from '../types';

export interface StagingDraftState {
  draftId: string;
  testTitle: string;
  listeningFileName?: string;
  readingFileName?: string;
  mp3FileName?: string;
  questions: StagingQuestion[];
  groups: StagingGroup[];
  audioSegments: AudioSegment[];
  lastUpdated: string;
}

export function getDraftKey(draftId: string = 'default'): string {
  return `ori:toeic-import-studio:${draftId.trim() || 'default'}`;
}

export function saveStagingDraft(state: StagingDraftState): void {
  try {
    const key = getDraftKey(state.draftId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save staging draft to localStorage:', e);
  }
}

export function loadStagingDraft(draftId: string = 'default'): StagingDraftState | null {
  try {
    const key = getDraftKey(draftId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.questions)) {
      return parsed as StagingDraftState;
    }
  } catch (e) {
    console.error('Failed to load staging draft from localStorage:', e);
  }
  return null;
}

export function clearStagingDraft(draftId: string = 'default'): void {
  try {
    const key = getDraftKey(draftId);
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Failed to clear staging draft from localStorage:', e);
  }
}
