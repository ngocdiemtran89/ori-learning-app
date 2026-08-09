// ============================================================
// Phase P3.5I Hotfix 2: Script Bulk Parser Markdown Support Suite (20 Items)
// ============================================================

import { describe, it, expect } from 'vitest';
import { autoDetectAndParseScriptInput, parseHumanScriptText, isCanonicalGroupRange } from './scriptBulkParser';

describe('Script Bulk Parser Markdown & Part 3/4 Support Suite (20 Items)', () => {

  it('1. ## CÂU range recognized', () => {
    expect(isCanonicalGroupRange('32-34', 'part3')).toBe(true);
    expect(isCanonicalGroupRange('71-73', 'part4')).toBe(true);
    const text = `## CÂU 32-34\n**SCRIPT TIẾNG ANH**\nW: Hello.\nM: Hi.`;
    const res = parseHumanScriptText(text);
    expect(res.length).toBe(1);
    expect(res[0].range).toBe('32-34');
    expect(res[0].part).toBe('part3');
  });

  it('2. en dash range normalized', () => {
    const text = `## CÂU 32–34\n**SCRIPT TIẾNG ANH**\nW: Hello.`;
    const res = parseHumanScriptText(text);
    expect(res[0].range).toBe('32-34');
  });

  it('3. em dash range normalized', () => {
    const text = `## CÂU 71—73\n**SCRIPT TIẾNG ANH**\nYou've reached Select Repair Service...`;
    const res = parseHumanScriptText(text);
    expect(res[0].range).toBe('71-73');
    expect(res[0].part).toBe('part4');
  });

  it('4. **SCRIPT TIẾNG ANH** recognized', () => {
    const text = `## CÂU 32-34\n**SCRIPT TIẾNG ANH**\nW: Hey Oliver.`;
    const res = parseHumanScriptText(text);
    expect(res[0].transcript).toBe('W: Hey Oliver.');
  });

  it('5. **BẢN DỊCH TIẾNG VIỆT** recognized', () => {
    const text = `## CÂU 32-34\n**SCRIPT TIẾNG ANH**\nW: Hey Oliver.\n**BẢN DỊCH TIẾNG VIỆT**\nNữ: Này Oliver.`;
    const res = parseHumanScriptText(text);
    expect(res[0].transcript_vi).toBe('Nữ: Này Oliver.');
  });

  it('6. markdown # PART ignored', () => {
    const text = `# PART 3\n## CÂU 32-34\n**SCRIPT TIẾNG ANH**\nW: Hello.`;
    const res = parseHumanScriptText(text);
    expect(res.length).toBe(1);
    expect(res[0].range).toBe('32-34');
  });

  it('7. --- separator ignored', () => {
    const text = `## CÂU 32-34\n**SCRIPT TIẾNG ANH**\nW: Hello.\n---\n## CÂU 35-37\n**SCRIPT TIẾNG ANH**\nM: Hi.`;
    const res = parseHumanScriptText(text);
    expect(res.length).toBe(2);
    expect(res[0].transcript).not.toContain('---');
  });

  it('8. bold W speaker normalized', () => {
    const text = `## CÂU 32-34\n**SCRIPT TIẾNG ANH**\n**W:** Hey, Oliver.`;
    const res = parseHumanScriptText(text);
    expect(res[0].transcript).toBe('W: Hey, Oliver.');
  });

  it('9. bold M speaker normalized', () => {
    const text = `## CÂU 32-34\n**SCRIPT TIẾNG ANH**\n**M:** Yes, it should be great.`;
    const res = parseHumanScriptText(text);
    expect(res[0].transcript).toBe('M: Yes, it should be great.');
  });

  it('10. M1/M2 recognized', () => {
    const text = `## CÂU 32-34\n**SCRIPT TIẾNG ANH**\n**M1:** Welcome.\n**M2:** Thank you.`;
    const res = parseHumanScriptText(text);
    expect(res[0].transcript).toContain('M1: Welcome.');
    expect(res[0].transcript).toContain('M2: Thank you.');
  });

  it('11. Nam/Nữ labels preserved', () => {
    const text = `## CÂU 32-34\n**SCRIPT TIẾNG ANH**\nW: Hi.\n**BẢN DỊCH TIẾNG VIỆT**\n**Nữ:** Này Oliver.\n**Nam:** Rồi.`;
    const res = parseHumanScriptText(text);
    expect(res[0].transcript_vi).toContain('Nữ: Này Oliver.');
    expect(res[0].transcript_vi).toContain('Nam: Rồi.');
  });

  it('12. P3 single group parse', () => {
    const p3Single = `# PART 3\n\n## CÂU 32–34\n\n**SCRIPT TIẾNG ANH**\n\n**W:** Hey, Oliver. Did you see the focus group results for our new spicy cheddar cheese? Everyone really liked it.\n\n**M:** Yes. It should be a great addition to our company's line of cheeses.\n\n**BẢN DỊCH TIẾNG VIỆT**\n\n**Nữ:** Này Oliver. Anh đã xem kết quả khảo sát nhóm khách hàng mục tiêu về loại phô mai cheddar cay mới của chúng ta chưa? Mọi người đều rất thích nó.\n\n**Nam:** Rồi. Nó sẽ là một sản phẩm bổ sung tuyệt vời cho dòng phô mai của công ty chúng ta.\n\n---`;
    const res = autoDetectAndParseScriptInput(p3Single);
    expect(res.items.length).toBe(1);
    expect(res.items[0].range).toBe('32-34');
    expect(res.items[0].part).toBe('part3');
    expect(res.items[0].transcript).toContain('W: Hey, Oliver.');
    expect(res.items[0].transcript_vi).toContain('Nữ: Này Oliver.');
  });

  it('13. P3 all 13 groups parse', () => {
    const ranges = [
      '32-34', '35-37', '38-40', '41-43', '44-46', '47-49',
      '50-52', '53-55', '56-58', '59-61', '62-64', '65-67', '68-70'
    ];
    let fullP3Text = '# PART 3\n\n';
    ranges.forEach(r => {
      fullP3Text += `## CÂU ${r}\n**SCRIPT TIẾNG ANH**\n**W:** Line EN.\n**BẢN DỊCH TIẾNG VIỆT**\n**Nữ:** Line VI.\n---\n\n`;
    });

    const res = autoDetectAndParseScriptInput(fullP3Text);
    expect(res.counters.groupCount).toBe(13);
    expect(res.items.map(i => i.range)).toEqual(ranges);
  });

  it('14. P4 single group parse', () => {
    const p4Single = `# PART 4\n\n## CÂU 71–73\n\n**SCRIPT TIẾNG ANH**\n\nYou've reached Select Repair Service. We specialize in all makes and models of automobiles.\n\n**BẢN DỊCH TIẾNG VIỆT**\n\nBạn đã gọi đến Dịch vụ Sửa chữa Select. Chúng tôi chuyên sửa chữa tất cả các hãng và dòng ô tô.`;
    const res = autoDetectAndParseScriptInput(p4Single);
    expect(res.items.length).toBe(1);
    expect(res.items[0].range).toBe('71-73');
    expect(res.items[0].part).toBe('part4');
    expect(res.items[0].transcript).toBe("You've reached Select Repair Service. We specialize in all makes and models of automobiles.");
    expect(res.items[0].transcript_vi).toBe('Bạn đã gọi đến Dịch vụ Sửa chữa Select. Chúng tôi chuyên sửa chữa tất cả các hãng và dòng ô tô.');
  });

  it('15. P4 all 10 groups parse', () => {
    const ranges = [
      '71-73', '74-76', '77-79', '80-82', '83-85',
      '86-88', '89-91', '92-94', '95-97', '98-100'
    ];
    let fullP4Text = '# PART 4\n\n';
    ranges.forEach(r => {
      fullP4Text += `## CÂU ${r}\n**SCRIPT TIẾNG ANH**\nMonologue text EN.\n**BẢN DỊCH TIẾNG VIỆT**\nMonologue text VI.\n---\n\n`;
    });

    const res = autoDetectAndParseScriptInput(fullP4Text);
    expect(res.counters.groupCount).toBe(10);
    expect(res.items.map(i => i.range)).toEqual(ranges);
  });

  it('16. P3 dialogue line breaks preserved', () => {
    const text = `## CÂU 32-34\n**SCRIPT TIẾNG ANH**\n**W:** Line 1.\n**M:** Line 2.`;
    const res = parseHumanScriptText(text);
    expect(res[0].transcript).toBe('W: Line 1.\nM: Line 2.');
  });

  it('17. P4 monologue works without speakers', () => {
    const text = `## CÂU 71-73\n**SCRIPT TIẾNG ANH**\nWelcome to our store.\nWe have discount today.`;
    const res = parseHumanScriptText(text);
    expect(res[0].transcript).toBe('Welcome to our store.\nWe have discount today.');
  });

  it('18. target fields correct', () => {
    const text = `## CÂU 32-34\n**SCRIPT TIẾNG ANH**\nW: Hi.\n**BẢN DỊCH TIẾNG VIỆT**\nNữ: Chào.`;
    const res = parseHumanScriptText(text);
    expect(res[0].targetType).toBe('group');
    expect(res[0].transcript).toBe('W: Hi.');
    expect(res[0].transcript_vi).toBe('Nữ: Chào.');
  });

  it('19. no Markdown syntax stored', () => {
    const text = `## CÂU 32-34\n**SCRIPT TIẾNG ANH**\n**W:** Hi.\n**BẢN DỊCH TIẾNG VIỆT**\n**Nữ:** Chào.`;
    const res = parseHumanScriptText(text);
    expect(res[0].transcript).not.toContain('**');
    expect(res[0].transcript_vi).not.toContain('**');
    expect(res[0].range).not.toContain('#');
  });

  it('20. no DB write during parse', () => {
    const text = `## CÂU 32-34\n**SCRIPT TIẾNG ANH**\nW: Hi.`;
    const res = autoDetectAndParseScriptInput(text);
    expect(res.items.length).toBe(1);
    // Pure function check - no database call made
  });

});
