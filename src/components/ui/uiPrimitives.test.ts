// ============================================================
// Phase P3.5I: Design System V1 Primitives & Contracts Suite
// ============================================================

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('ORI Learning Design System V1 — Primitives & Contracts Suite', () => {
  it('1. Verifies docs/DESIGN_SYSTEM.md documentation exists and covers Design System guidelines', () => {
    const docPath = path.join(process.cwd(), 'docs/DESIGN_SYSTEM.md');
    expect(fs.existsSync(docPath)).toBe(true);

    const content = fs.readFileSync(docPath, 'utf8');
    expect(content).toContain('ORI LEARNING — DESIGN SYSTEM V1');
    expect(content).toContain('Typography Roles');
    expect(content).toContain('Vietnamese Typography Rules');
    expect(content).toContain('Tabular Numerals');
  });

  it('2. Verifies index.css contains semantic typography roles and tabular-nums utility', () => {
    const cssPath = path.join(process.cwd(), 'src/index.css');
    expect(fs.existsSync(cssPath)).toBe(true);

    const cssContent = fs.readFileSync(cssPath, 'utf8');
    expect(cssContent).toContain('.tabular-nums');
    expect(cssContent).toContain('.type-page-title');
    expect(cssContent).toContain('.type-section-heading');
    expect(cssContent).toContain('.type-component-heading');
    expect(cssContent).toContain('.type-body');
  });

  it('3. Verifies UI primitive exports exist in src/components/ui/index.ts', () => {
    const indexPath = path.join(process.cwd(), 'src/components/ui/index.ts');
    expect(fs.existsSync(indexPath)).toBe(true);

    const indexContent = fs.readFileSync(indexPath, 'utf8');
    expect(indexContent).toContain('./Button');
    expect(indexContent).toContain('./Badge');
    expect(indexContent).toContain('./Card');
    expect(indexContent).toContain('./PageHeader');
    expect(indexContent).toContain('./SectionHeader');
    expect(indexContent).toContain('./StatCard');
    expect(indexContent).toContain('./Tabs');
    expect(indexContent).toContain('./AdminTable');
  });

  it('4. Verifies /admin/design-system route is registered in App.tsx', () => {
    const appPath = path.join(process.cwd(), 'src/App.tsx');
    expect(fs.existsSync(appPath)).toBe(true);

    const appContent = fs.readFileSync(appPath, 'utf8');
    expect(appContent).toContain('/admin/design-system');
    expect(appContent).toContain('AdminDesignSystemPage');
  });
});
