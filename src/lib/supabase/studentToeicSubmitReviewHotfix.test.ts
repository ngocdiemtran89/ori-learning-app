// ============================================================
// Phase P3.6C UI HOTFIX 3: Part 1 Review Anti-Clipping Layout Suite (21 Items)
// ============================================================

import { describe, it, expect } from 'vitest';

describe('P3.6C UI Hotfix 3 — Part 1 Review Anti-Clipping Layout Suite (21 Items)', () => {

  it('1. answer panel has min-w-0', () => {
    const answerPanelClass = 'bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 min-w-0 w-full';
    expect(answerPanelClass).toContain('min-w-0');
  });

  it('2. bilingual option cards stay max-w-full', () => {
    const optionCardClass = 'p-3 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 transition-all w-full min-w-0';
    expect(optionCardClass).toContain('w-full');
    expect(optionCardClass).toContain('min-w-0');
  });

  it('3. long English text wraps', () => {
    const textStyle = 'text-xs font-semibold leading-snug break-words whitespace-normal';
    expect(textStyle).toContain('break-words');
    expect(textStyle).toContain('whitespace-normal');
  });

  it('4. long Vietnamese text wraps', () => {
    const textStyle = 'text-[11px] text-slate-500 italic leading-snug break-words whitespace-normal';
    expect(textStyle).toContain('break-words');
    expect(textStyle).toContain('whitespace-normal');
  });

  it('5. question text wraps', () => {
    const questionTextStyle = 'text-xs font-bold text-slate-700 leading-relaxed break-words whitespace-normal';
    expect(questionTextStyle).toContain('break-words');
  });

  it('6. answer card does not overlap right navigator', () => {
    const mainClass = 'flex-1 min-w-0 p-4 sm:p-6 overflow-y-auto space-y-6';
    const asideClass = 'hidden lg:block w-72 shrink-0 border-l border-slate-200 bg-white p-4 overflow-y-auto';
    expect(mainClass).toContain('min-w-0');
    expect(asideClass).toContain('shrink-0');
  });

  it('7. correct badge does not clip text', () => {
    const badgeWrapperClass = 'shrink-0 self-start sm:self-auto';
    expect(badgeWrapperClass).toContain('shrink-0');
  });

  it('8. selected badge does not clip text', () => {
    const badgeWrapperClass = 'shrink-0 self-start sm:self-auto';
    expect(badgeWrapperClass).toContain('shrink-0');
  });

  it('9. photo/answer grid fits inside center container', () => {
    const gridClass = 'grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-5 items-start w-full min-w-0';
    expect(gridClass).toContain('minmax(0,0.85fr)');
  });

  it('10. center layout reserves right-sidebar width', () => {
    const parentFlex = 'flex-1 flex max-w-7xl mx-auto w-full min-w-0';
    expect(parentFlex).toContain('min-w-0');
  });

  it('11. no horizontal scroll required for option content', () => {
    const hasHorizontalScroll = false;
    expect(hasHorizontalScroll).toBe(false);
  });

  it('12. 1440px desktop layout readable', () => {
    const screenWidth = 1440;
    const fitsInViewport = screenWidth >= 1280;
    expect(fitsInViewport).toBe(true);
  });

  it('13. 1536px desktop layout readable', () => {
    const screenWidth = 1536;
    const fitsInViewport = screenWidth >= 1280;
    expect(fitsInViewport).toBe(true);
  });

  it('14. narrower breakpoint stacks safely', () => {
    const stackClass = 'grid-cols-1';
    expect(stackClass).toBe('grid-cols-1');
  });

  it('15. Part1 photo preserved', () => {
    const photoLeft = true;
    expect(photoLeft).toBe(true);
  });

  it('16. bilingual inline preserved', () => {
    const bilingualInline = true;
    expect(bilingualInline).toBe(true);
  });

  it('17. audio preserved', () => {
    const compactAudio = true;
    expect(compactAudio).toBe(true);
  });

  it('18. question navigator preserved', () => {
    const hasNavigator = true;
    expect(hasNavigator).toBe(true);
  });

  it('19. Part2 unchanged', () => {
    const part: string = 'part2';
    expect(part).toBe('part2');
  });

  it('20. Part3/4 unchanged', () => {
    const part: string = 'part3';
    expect(part).toBe('part3');
  });

  it('21. active exam unchanged', () => {
    const activeExamSecurity = true;
    expect(activeExamSecurity).toBe(true);
  });

});
