import { describe, it, expect } from 'vitest';
import { buildPart6BilingualSegments } from './part6BilingualAligner';

describe('Part 6 Bilingual Passage Aligner Suite', () => {
  it('A. parses title EN and VI pair', () => {
    const en = `Look to Riessler Landscaping for your Garden Needs\n\nRiessler Landscaping has everything you need... ------- 131.`;
    const vi = `Hãy tìm đến Riessler Landscaping cho nhu cầu làm vườn của bạn\n\nRiessler Landscaping có mọi thứ bạn cần... ------- 131.`;

    const segments = buildPart6BilingualSegments(en, vi);
    expect(segments[0].isTitle).toBe(true);
    expect(segments[0].en).toBe('Look to Riessler Landscaping for your Garden Needs');
    expect(segments[0].vi).toBe('Hãy tìm đến Riessler Landscaping cho nhu cầu làm vườn của bạn');
  });

  it('B. pairs normal sentences without blank markers', () => {
    const en = `Sentence one. Sentence two.`;
    const vi = `Câu một. Câu hai.`;

    const segments = buildPart6BilingualSegments(en, vi);
    expect(segments.length).toBeGreaterThanOrEqual(1);
    expect(segments[0].en).toContain('Sentence one');
    expect(segments[0].vi).toContain('Câu một');
  });

  it('C & D. pairs blank 131 and 132 anchored sentences accurately', () => {
    const en = `First paragraph.\nWe will listen to your ideas ------- 131. We are equipped to construct ------- 132.`;
    const vi = `Đoạn đầu tiên.\nChúng tôi sẽ lắng nghe ý tưởng ------- 131. Chúng tôi được trang bị để xây dựng ------- 132.`;

    const segments = buildPart6BilingualSegments(en, vi);
    const seg131 = segments.find(s => s.questionNumbers.includes(131));
    const seg132 = segments.find(s => s.questionNumbers.includes(132));

    expect(seg131).toBeDefined();
    expect(seg131?.en).toContain('------- 131');
    expect(seg131?.vi).toContain('------- 131');

    expect(seg132).toBeDefined();
    expect(seg132?.en).toContain('------- 132');
    expect(seg132?.vi).toContain('------- 132');
  });

  it('E. handles multiline sentences correctly', () => {
    const en = `Line 1 sentence.\nLine 2 sentence continuation.`;
    const vi = `Dòng 1 câu.\nDòng 2 tiếp nối.`;

    const segments = buildPart6BilingualSegments(en, vi);
    expect(segments.length).toBe(2);
    expect(segments[0].en).toBe('Line 1 sentence.');
    expect(segments[1].en).toBe('Line 2 sentence continuation.');
  });

  it('F. handles paragraph or sentence mismatch fallback without dropping text', () => {
    const en = `EN Paragraph 1.\nEN Paragraph 2 extra sentence.\nEN Paragraph 3. ------- 131.`;
    const vi = `VI Paragraph 1.\nVI Paragraph 3. ------- 131.`;

    const segments = buildPart6BilingualSegments(en, vi);
    const allEn = segments.map(s => s.en).join(' ');
    const allVi = segments.map(s => s.vi).join(' ');

    expect(allEn).toContain('EN Paragraph 2 extra sentence');
    expect(allVi).toContain('VI Paragraph 3');
  });

  it('G. handles missing VI passage (English only)', () => {
    const en = `Look to Riessler Landscaping ------- 131.`;
    const segments = buildPart6BilingualSegments(en, null);

    expect(segments.length).toBe(1);
    expect(segments[0].en).toBe(en);
    expect(segments[0].vi).toBe('');
    expect(segments[0].questionNumbers).toEqual([131]);
  });

  it('H. handles missing EN passage (Vietnamese only)', () => {
    const vi = `Hãy tìm đến Riessler Landscaping ------- 131.`;
    const segments = buildPart6BilingualSegments('', vi);

    expect(segments.length).toBe(1);
    expect(segments[0].vi).toBe(vi);
    expect(segments[0].en).toBe('');
    expect(segments[0].questionNumbers).toEqual([131]);
  });

  it('I. ensures NO duplicate output', () => {
    const en = `Para 1.\nPara 2 ------- 131.`;
    const vi = `Bản dịch 1.\nBản dịch 2 ------- 131.`;

    const segments = buildPart6BilingualSegments(en, vi);
    const enTexts = segments.map(s => s.en).filter(Boolean);
    const viTexts = segments.map(s => s.vi).filter(Boolean);

    expect(new Set(enTexts).size).toBe(enTexts.length);
    expect(new Set(viTexts).size).toBe(viTexts.length);
  });

  it('J. guarantees NO text loss for complete Riessler Landscaping sample', () => {
    const sampleGroupTextEn = `Look to Riessler Landscaping for your Garden Needs

Riessler Landscaping has everything you need to create your dream garden.
We will listen to your ideas and offer suggestions that match your gardening desires.
------- 131. The nursery here at Riessler Landscaping includes plants...
------- 132. to your garden. We are...
------- 133. equipped to construct small ponds...
------- 134. expertise is unmatched.`;

    const sampleGroupTextVi = `Hãy tìm đến Riessler Landscaping cho nhu cầu làm vườn của bạn

Riessler Landscaping có mọi thứ bạn cần để tạo nên khu vườn trong mơ của mình.
Chúng tôi sẽ lắng nghe ý tưởng của bạn và đưa ra những gợi ý phù hợp với mong muốn làm vườn của bạn.
------- 131. Vườn ươm tại Riessler Landscaping bao gồm các loại cây...
------- 132. cho khu vườn của bạn. Chúng tôi...
------- 133. được trang bị để xây dựng các hồ nhỏ...
------- 134. chuyên môn là vô song.`;

    const segments = buildPart6BilingualSegments(sampleGroupTextEn, sampleGroupTextVi);
    expect(segments.length).toBeGreaterThanOrEqual(4);

    const fullRenderedEn = segments.map(s => s.en).join('\n');
    const fullRenderedVi = segments.map(s => s.vi).join('\n');

    expect(fullRenderedEn).toContain('Riessler Landscaping');
    expect(fullRenderedEn).toContain('------- 131.');
    expect(fullRenderedEn).toContain('------- 134.');

    expect(fullRenderedVi).toContain('Riessler Landscaping');
    expect(fullRenderedVi).toContain('------- 131.');
    expect(fullRenderedVi).toContain('------- 134.');
  });
});
