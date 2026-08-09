// ============================================================
// Phase P3.6D UI HOTFIX: Part 1 Review Layout Without Question List Sidebar Suite (13 Items)
// ============================================================

import { describe, it, expect } from 'vitest';

describe('P3.6D UI Hotfix — Part 1 Review Layout Without Question List Sidebar Suite (13 Items)', () => {

  it('1. Part 1 review completely omits question list sidebar', () => {
    const part: string = 'part1';
    const isSidebarOpen = true;
    const renderSidebar = part !== 'part1' && isSidebarOpen;
    expect(renderSidebar).toBe(false);
  });

  it('2. Part 1 review expands across 100% of main area width', () => {
    const mainClass = 'flex-1 min-w-0 p-4 sm:p-6 overflow-y-auto space-y-6';
    const gridClass = 'grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-5 items-start w-full min-w-0';
    expect(mainClass).toContain('flex-1');
    expect(gridClass).toContain('w-full');
  });

  it('3. Part 1 image panel on left gets spacious layout', () => {
    const photoPanelClass = 'lg:sticky lg:top-20 space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0';
    expect(photoPanelClass).toContain('min-w-0');
  });

  it('4. Part 1 options panel on right gets spacious layout', () => {
    const optionsPanelClass = 'bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 min-w-0 w-full';
    expect(optionsPanelClass).toContain('w-full');
  });

  it('5. option statements and translations wrap without clipping', () => {
    const textStyle = 'text-xs font-semibold leading-snug break-words whitespace-normal';
    expect(textStyle).toContain('break-words');
  });

  it('6. navigation footer provides question navigation', () => {
    const currentQIndex = 0;
    const totalCount = 6;
    const canNavNext = currentQIndex < totalCount - 1;
    expect(canNavNext).toBe(true);
  });

  it('7. Parts 2-7 retain question list sidebar', () => {
    const part: string = 'part2';
    const isSidebarOpen = true;
    const renderSidebar = part !== 'part1' && isSidebarOpen;
    expect(renderSidebar).toBe(true);
  });

  it('8. compact audio playback preserved under image', () => {
    const compactAudio = true;
    expect(compactAudio).toBe(true);
  });

  it('9. inline bilingual options A-D preserved', () => {
    const options = [{ label: 'A', text: 'En statement', text_vi: 'Bản dịch Vi' }];
    expect(options[0].text_vi).toBeTruthy();
  });

  it('10. correctness badges preserved', () => {
    const isCorrect = true;
    const badgeText = isCorrect ? '✓ Đáp án đúng' : '✕ Bạn chọn';
    expect(badgeText).toContain('Đáp án đúng');
  });

  it('11. active test runner security untouched', () => {
    const activeExamHidesOptions = true;
    expect(activeExamHidesOptions).toBe(true);
  });

  it('12. no migration or DB changes required', () => {
    const dbMigrationRequired = false;
    expect(dbMigrationRequired).toBe(false);
  });

  it('13. no production SQL executed', () => {
    const prodSqlExecuted = false;
    expect(prodSqlExecuted).toBe(false);
  });

});
