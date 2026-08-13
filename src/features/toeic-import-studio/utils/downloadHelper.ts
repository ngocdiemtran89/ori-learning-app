/**
 * Canonical Browser-Safe Download Helper for ORI TOEIC Import Studio (Phase 1.2)
 * Guarantees human-readable filenames on Chrome & Safari on macOS.
 */

export function downloadBlob(blob: Blob, filename: string): void {
  if (!filename || filename.trim().length === 0) {
    throw new Error('Filename cannot be empty.');
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Node test environment fallback
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();
  a.remove();

  // Safe delay (10s) before revoking object URL to ensure Chrome/Safari retain filename metadata
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore revocation error
    }
  }, 10000);
}

export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

export function downloadJsonFile(data: object | string, filename: string): void {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, filename);
}
