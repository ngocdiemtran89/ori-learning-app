import { describe, it, expect } from 'vitest';
import { parseFourOptions } from './fourOptionsParser';

describe('Four Options Parser Test Suite', () => {
  it('1. parses (A)-(D) format', () => {
    const text = `(A) years\n(B) space\n(C) beauty\n(D) moisture`;
    const res = parseFourOptions(text);
    expect(res).toEqual(['years', 'space', 'beauty', 'moisture']);
  });

  it('2. parses A.-D. format', () => {
    const text = `A. option a\nB. option b\nC. option c\nD. option d`;
    const res = parseFourOptions(text);
    expect(res).toEqual(['option a', 'option b', 'option c', 'option d']);
  });

  it('3. parses A)-D) format', () => {
    const text = `A) option a\nB) option b\nC) option c\nD) option d`;
    const res = parseFourOptions(text);
    expect(res).toEqual(['option a', 'option b', 'option c', 'option d']);
  });

  it('4. parses A:-D: format', () => {
    const text = `A: option a\nB: option b\nC: option c\nD: option d`;
    const res = parseFourOptions(text);
    expect(res).toEqual(['option a', 'option b', 'option c', 'option d']);
  });

  it('5. parses 4 plain non-empty lines without markers', () => {
    const text = `years\nspace\nbeauty\nmoisture`;
    const res = parseFourOptions(text);
    expect(res).toEqual(['years', 'space', 'beauty', 'moisture']);
  });

  it('6. parses multiline wrapped options (EN)', () => {
    const text = `(A) Staff members have written articles
for the local newspaper.

(B) Installing lights can enhance the effect
of a well-designed garden.

(C) Local competitors cannot beat
the prices we charge.

(D) Riessler Landscaping’s goal is to make
your vision a reality.`;

    const res = parseFourOptions(text);
    expect(res).toEqual([
      'Staff members have written articles for the local newspaper.',
      'Installing lights can enhance the effect of a well-designed garden.',
      'Local competitors cannot beat the prices we charge.',
      'Riessler Landscaping’s goal is to make your vision a reality.',
    ]);
  });

  it('7. parses multiline wrapped options (VI)', () => {
    const text = `(A) Các nhân viên đã viết bài
cho tờ báo địa phương.

(B) Việc lắp đặt đèn có thể làm tăng hiệu quả
của một khu vườn được thiết kế đẹp.

(C) Các đối thủ cạnh tranh trong khu vực
không thể đưa ra mức giá tốt hơn.

(D) Mục tiêu của Riessler Landscaping là
biến ý tưởng của bạn thành hiện thực.`;

    const res = parseFourOptions(text);
    expect(res).toEqual([
      'Các nhân viên đã viết bài cho tờ báo địa phương.',
      'Việc lắp đặt đèn có thể làm tăng hiệu quả của một khu vườn được thiết kế đẹp.',
      'Các đối thủ cạnh tranh trong khu vực không thể đưa ra mức giá tốt hơn.',
      'Mục tiêu của Riessler Landscaping là biến ý tưởng của bạn thành hiện thực.',
    ]);
  });

  it('8. returns null for single line or non-four option text', () => {
    const singleText = `Single sentence or regular text paste.`;
    const res = parseFourOptions(singleText);
    expect(res).toBeNull();
  });
});
