import { describe, it, expect } from 'vitest';
import { isValidUuid } from './grammar';

describe('Grammar Lesson Fetch Identifier Validation', () => {
  it('identifies string slug "present-simple-foundation" as NOT a UUID', () => {
    expect(isValidUuid('present-simple-foundation')).toBe(false);
  });

  it('identifies valid UUID string as a UUID', () => {
    expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isValidUuid('86dbaa70-0000-4000-8000-000000000000')).toBe(true);
  });

  it('identifies empty or malformed strings as NOT a UUID', () => {
    expect(isValidUuid('')).toBe(false);
    expect(isValidUuid('12345')).toBe(false);
    expect(isValidUuid('grammar-lesson-1')).toBe(false);
  });
});
