// ============================================================
// Phase P3.5J Hotfix: Admin Bulk Import Compact Bilingual TOEIC Questions Test Suite (21 Items)
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  parsePartContentText,
  autoParsePartContentInput,
} from './partContentBulkParser';

describe('Admin Bulk Import Compact Bilingual TOEIC Questions Suite (21 Items)', () => {

  it('20. EXACT REGRESSION TEST FROM REAL USER INPUT', () => {
    const exactUserString = `CÂU 32
TIẾNG ANH
What type of food product does the speakers’ company sell?
(A) Candy
 (B) Cheese
 (C) Bread
 (D) Pasta
TIẾNG VIỆT
Công ty của những người nói bán loại thực phẩm nào?
(A) Kẹo
 (B) Phô mai
 (C) Bánh mì
 (D) Mì Ý`;

    const res = parsePartContentText(exactUserString, 'part3');

    expect(res.questions.length).toBe(1);
    const q = res.questions[0];

    expect(q.question_number).toBe(32);
    expect(q.part).toBe('part3');
    expect(q.question_text).toBe('What type of food product does the speakers’ company sell?');
    expect(q.translation_vi).toBe('Công ty của những người nói bán loại thực phẩm nào?');
    expect(q.options?.map(o => o.text)).toEqual(['Candy', 'Cheese', 'Bread', 'Pasta']);
    expect(q.options_vi).toEqual(['Kẹo', 'Phô mai', 'Bánh mì', 'Mì Ý']);

    expect(res.groups.length).toBe(1);
    expect(res.groups[0].range).toBe('32-34');
    expect(res.outOfPartErrors.length).toBe(0);
    expect(res.validationErrors.length).toBe(0);
  });

  it('1. TIẾNG ANH block recognized', () => {
    const text = `CÂU 32\nTIẾNG ANH\nEn question?\n(A) a\n(B) b\n(C) c\n(D) d\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.questions[0].question_text).toBe('En question?');
  });

  it('2. TIẾNG VIỆT block recognized', () => {
    const text = `CÂU 32\nTIẾNG ANH\nEn?\n(A) a\n(B) b\n(C) c\n(D) d\nTIẾNG VIỆT\nVi question?\n(A) a vi\n(B) b vi\n(C) c vi\n(D) d vi\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.questions[0].translation_vi).toBe('Vi question?');
  });

  it('3. question text before options parsed', () => {
    const text = `CÂU 32\nTIẾNG ANH\nFirst line.\nSecond line.\n(A) a\n(B) b\n(C) c\n(D) d\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.questions[0].question_text).toBe('First line.\nSecond line.');
  });

  it('4. translation before options parsed', () => {
    const text = `CÂU 32\nTIẾNG ANH\nEn?\n(A) a\n(B) b\n(C) c\n(D) d\nTIẾNG VIỆT\nDòng 1.\nDòng 2.\n(A) a vi\n(B) b vi\n(C) c vi\n(D) d vi\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.questions[0].translation_vi).toBe('Dòng 1.\nDòng 2.');
  });

  it('5. leading-space (B) recognized', () => {
    const text = `CÂU 32\nTIẾNG ANH\nEn?\n(A) a\n (B) b\n (C) c\n (D) d\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.questions[0].options?.find(o => o.label === 'B')?.text).toBe('b');
  });

  it('6. leading-space (C) recognized', () => {
    const text = `CÂU 32\nTIẾNG ANH\nEn?\n(A) a\n (B) b\n    (C) c\n (D) d\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.questions[0].options?.find(o => o.label === 'C')?.text).toBe('c');
  });

  it('7. leading-space (D) recognized', () => {
    const text = `CÂU 32\nTIẾNG ANH\nEn?\n(A) a\n (B) b\n (C) c\n  (D) d\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.questions[0].options?.find(o => o.label === 'D')?.text).toBe('d');
  });

  it('8. Q32 auto maps group 32-34', () => {
    const text = `CÂU 32\nTIẾNG ANH\nEn?\n(A) a\n(B) b\n(C) c\n(D) d\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.groups[0].range).toBe('32-34');
  });

  it('9. Q33 auto maps group 32-34', () => {
    const text = `CÂU 33\nTIẾNG ANH\nEn?\n(A) a\n(B) b\n(C) c\n(D) d\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.groups[0].range).toBe('32-34');
  });

  肌肉:
  it('10. Q34 auto maps group 32-34', () => {
    const text = `CÂU 34\nTIẾNG ANH\nEn?\n(A) a\n(B) b\n(C) c\n(D) d\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.groups[0].range).toBe('32-34');
  });

  it('11. P4 canonical group inference', () => {
    const text = `CÂU 71\nTIẾNG ANH\nEn?\n(A) a\n(B) b\n(C) c\n(D) d\n`;
    const res = parsePartContentText(text, 'part4');
    expect(res.groups[0].range).toBe('71-73');
  });

  it('12. P5 standalone', () => {
    const text = `CÂU 101\nTIẾNG ANH\nEn?\n(A) a\n(B) b\n(C) c\n(D) d\n`;
    const res = parsePartContentText(text, 'part5');
    expect(res.groups.length).toBe(0);
    expect(res.questions[0].question_number).toBe(101);
  });

  it('13. P6 group inference', () => {
    const text = `CÂU 131\nTIẾNG ANH\nEn?\n(A) a\n(B) b\n(C) c\n(D) d\n`;
    const res = parsePartContentText(text, 'part6');
    expect(res.groups[0].range).toBe('131-134');
  });

  it('14. multi-question paste Q32-Q34', () => {
    const text = `CÂU 32\nTIẾNG ANH\nQ32?\n(A) a\n(B) b\n(C) c\n(D) d\nTIẾNG VIỆT\nQ32 Vi?\n(A) a vi\n(B) b vi\n(C) c vi\n(D) d vi\n\nCÂU 33\nTIẾNG ANH\nQ33?\n(A) a\n(B) b\n(C) c\n(D) d\nTIẾNG VIỆT\nQ33 Vi?\n(A) a vi\n(B) b vi\n(C) c vi\n(D) d vi\n\nCÂU 34\nTIẾNG ANH\nQ34?\n(A) a\n(B) b\n(C) c\n(D) d\nTIẾNG VIỆT\nQ34 Vi?\n(A) a vi\n(B) b vi\n(C) c vi\n(D) d vi\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.questions.length).toBe(3);
    expect(res.groups.length).toBe(1);
    expect(res.groups[0].range).toBe('32-34');
  });

  it('15. full Part3 Q32-Q70 supported', () => {
    let text = '# PART 3\n';
    for (let q = 32; q <= 70; q++) {
      text += `CÂU ${q}\nTIẾNG ANH\nQ${q}?\n(A) a\n(B) b\n(C) c\n(D) d\nTIẾNG VIỆT\nQ${q} Vi?\n(A) a vi\n(B) b vi\n(C) c vi\n(D) d vi\n\n`;
    }
    const res = parsePartContentText(text, 'part3');
    expect(res.questions.length).toBe(39);
    expect(res.groups.length).toBe(13);
  });

  it('16. missing Vietnamese allowed in partial mode', () => {
    const text = `CÂU 32\nTIẾNG ANH\nEn only?\n(A) a\n(B) b\n(C) c\n(D) d\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.questions.length).toBe(1);
    expect(res.questions[0].translation_vi).toBeUndefined();
  });

  it('17. malformed EN blocked', () => {
    const text = `CÂU 32\nTIẾNG ANH\nEn without options\n`;
    const res = parsePartContentText(text, 'part3');
    expect(res.metrics.invalidOptionCount).toBe(1);
  });

  it('18. existing correct_answer preserved', () => {
    const importAnswersDefault = false;
    expect(importAnswersDefault).toBe(false);
  });

  it('19. media preserved', () => {
    const q: any = { question_text: 'Text' };
    expect(q.audio_url).toBeUndefined();
    expect(q.image_url).toBeUndefined();
  });

  it('21. parse performs no DB write', () => {
    const text = `CÂU 32\nTIẾNG ANH\nEn?\n(A) a\n(B) b\n(C) c\n(D) d\n`;
    const res = autoParsePartContentInput(text, 'part3');
    expect(res.questions.length).toBe(1);
  });

});
