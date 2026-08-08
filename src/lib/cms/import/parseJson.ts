/**
 * JSON Parser for Phase 3.5 Import Center
 * Parses JSON strings into normalized record arrays.
 */

export interface ParsedJsonResult<T = any> {
  records: T[];
  errors: string[];
}

export function parseJsonContent<T = any>(jsonContent: string): ParsedJsonResult<T> {
  if (!jsonContent || !jsonContent.trim()) {
    return { records: [], errors: ['File JSON rỗng hoặc không chứa dữ liệu.'] };
  }

  try {
    const parsed = JSON.parse(jsonContent);

    if (Array.isArray(parsed)) {
      return { records: parsed as T[], errors: [] };
    }

    if (typeof parsed === 'object' && parsed !== null) {
      // Support module root wrappers ({ items: [...] }, { lessons: [...] }, { words: [...] })
      const possibleArrays = ['records', 'items', 'lessons', 'words', 'data'];
      for (const key of possibleArrays) {
        if (Array.isArray((parsed as any)[key])) {
          return { records: (parsed as any)[key] as T[], errors: [] };
        }
      }
      return { records: [parsed as T], errors: [] };
    }

    return { records: [], errors: ['Cấu trúc JSON không hợp lệ (cần là danh sách mảng các đối tượng).'] };
  } catch (err: any) {
    return { records: [], errors: [`Lỗi cú pháp JSON: ${err.message}`] };
  }
}
