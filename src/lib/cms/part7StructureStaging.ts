/**
 * Part 7 Multi-Batch Structure Staging Helper
 * Manages local browser staging for multi-chunk structure scanning before lock/apply.
 */

const STORAGE_PREFIX = 'ori:part7-structure-scan:';
const memoryStore = new Map<string, string>();

export interface Part7StagedBatch {
  id: string;
  timestamp: string;
  rawText: string;
}

export interface Part7StagedScanState {
  testId: string;
  batches: Part7StagedBatch[];
  combinedRawText: string;
  updatedAt: string;
}

export function getStagedScanKey(testId: string): string {
  return `${STORAGE_PREFIX}${testId}`;
}

export function loadStagedScan(testId: string): Part7StagedScanState | null {
  const key = getStagedScanKey(testId);
  try {
    let raw: string | null = null;
    if (typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(key);
    }
    if (!raw) {
      raw = memoryStore.get(key) || null;
    }
    if (!raw) return null;
    return JSON.parse(raw) as Part7StagedScanState;
  } catch {
    const raw = memoryStore.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as Part7StagedScanState;
  }
}

export function saveStagedBatch(testId: string, rawText: string): Part7StagedScanState {
  const existing = loadStagedScan(testId) || {
    testId,
    batches: [],
    combinedRawText: '',
    updatedAt: new Date().toISOString(),
  };

  const newBatch: Part7StagedBatch = {
    id: `batch-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    rawText,
  };

  const updatedBatches = [...existing.batches, newBatch];
  const combinedRawText = updatedBatches.map((b) => b.rawText).join('\n\n');

  const state: Part7StagedScanState = {
    testId,
    batches: updatedBatches,
    combinedRawText,
    updatedAt: new Date().toISOString(),
  };

  const key = getStagedScanKey(testId);
  const jsonStr = JSON.stringify(state);
  memoryStore.set(key, jsonStr);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, jsonStr);
    }
  } catch {
    // ignore
  }

  return state;
}

export function clearStagedScan(testId: string): void {
  const key = getStagedScanKey(testId);
  memoryStore.delete(key);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
