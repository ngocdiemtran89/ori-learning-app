import { describe, it, expect } from 'vitest';
import {
  parsePart7StructureFromText,
  extractQuestionNumbersFromBlock,
  computePassageFingerprint,
} from './part7StructureParser';

describe('Part 7 Structure Parser Suite', () => {
  it('1. parses "Questions 147–148" header with en dash into exact range [147, 148]', () => {
    const text = `Questions 147–148 refer to the following notice.\n\nNotice text...\n\n147. Q1?\n(A) a\n(B) b\n(C) c\n(D) d\n\n148. Q2?\n(A) a\n(B) b\n(C) c\n(D) d`;
    const res = parsePart7StructureFromText(text);

    expect(res.length).toBe(1);
    expect(res[0].startQuestion).toBe(147);
    expect(res[0].endQuestion).toBe(148);
    expect(res[0].questionNumbers).toEqual([147, 148]);
    expect(res[0].status).toBe('complete');
  });

  it('2. parses hyphen "-" in "Questions 149-151"', () => {
    const text = `Questions 149-151 refer to the following email.\n\nText...\n\n149. Q149?\n(A) a\n150. Q150?\n(A) a\n151. Q151?\n(A) a`;
    const res = parsePart7StructureFromText(text);

    expect(res[0].startQuestion).toBe(149);
    expect(res[0].endQuestion).toBe(151);
    expect(res[0].questionNumbers).toEqual([149, 150, 151]);
  });

  it('3. parses en dash "–" in header', () => {
    const text = `Questions 152–154 refer to the following ad.\n\nText...\n\n152. Q152?\n(A) a\n153. Q153?\n(A) a\n154. Q154?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res[0].startQuestion).toBe(152);
    expect(res[0].endQuestion).toBe(154);
  });

  it('4. parses em dash "—" in header', () => {
    const text = `Questions 155—157 refer to the following article.\n\nText...\n\n155. Q155?\n(A) a\n156. Q156?\n(A) a\n157. Q157?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res[0].startQuestion).toBe(155);
    expect(res[0].endQuestion).toBe(157);
  });

  it('5. handles flexible spacing around dash and keywords', () => {
    const text = `Questions    158   -   160    refer    to the following letter.\n\nText...\n\n158. Q158?\n(A) a\n159. Q159?\n(A) a\n160. Q160?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res[0].startQuestion).toBe(158);
    expect(res[0].endQuestion).toBe(160);
  });

  it('6. handles capitalization variations (QUESTIONS, Questions, câu hỏi)', () => {
    const text = `QUESTIONS 161-163 REFER TO...\n\nText...\n\n161. Q161?\n(A) a\n162. Q162?\n(A) a\n163. Q163?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res[0].startQuestion).toBe(161);
    expect(res[0].endQuestion).toBe(163);
  });

  it('7. parses 2-question group correctly', () => {
    const text = `Questions 147-148 refer...\n\nText...\n\n147. Q147?\n(A) a\n148. Q148?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res[0].questionNumbers.length).toBe(2);
  });

  it('8. parses 3-question group correctly', () => {
    const text = `Questions 149-151 refer...\n\nText...\n\n149. Q149?\n(A) a\n150. Q150?\n(A) a\n151. Q151?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res[0].questionNumbers.length).toBe(3);
  });

  it('9. parses 4-question group correctly', () => {
    const text = `Questions 152-155 refer...\n\nText...\n\n152. Q152?\n(A) a\n153. Q153?\n(A) a\n154. Q154?\n(A) a\n155. Q155?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res[0].questionNumbers.length).toBe(4);
  });

  it('10. parses 5-question group correctly', () => {
    const text = `Questions 180-184 refer...\n\nText...\n\n180. Q180?\n(A) a\n181. Q181?\n(A) a\n182. Q182?\n(A) a\n183. Q183?\n(A) a\n184. Q184?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res[0].questionNumbers.length).toBe(5);
  });

  it('11. parses dynamic N question group correctly', () => {
    const text = `Questions 190-195 refer...\n\nText...\n\n190. Q190?\n(A) a\n191. Q191?\n(A) a\n192. Q192?\n(A) a\n193. Q193?\n(A) a\n194. Q194?\n(A) a\n195. Q195?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res[0].questionNumbers.length).toBe(6);
  });

  it('12. ignores passage text numbers like "Room 147", "May 3", "$149"', () => {
    const passage = `Special Notice\nPlease come to Room 147 on May 3 at 9:00 AM. The entrance fee is $149.\n\n147. What is true?\n(A) a`;
    const nums = extractQuestionNumbersFromBlock(passage);
    expect(nums).toEqual([147]);
  });

  it('13. detects question block Q149 outside header Q147-148 as error', () => {
    const text = `Questions 147-148 refer to...\n\nText...\n\n147. Q147?\n(A) a\n148. Q148?\n(A) a\n149. Q149?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res[0].status).toBe('invalid');
    expect(res[0].validationError).toContain('Q149 nằm ngoài range');
  });

  it('14. marks missing declared question as incomplete', () => {
    const text = `Questions 159-161 refer to...\n\nText...\n\n159. Q159?\n(A) a\n160. Q160?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res[0].status).toBe('incomplete');
    expect(res[0].validationError).toContain('Thiếu câu: Q161');
  });

  it('15. passage fingerprint computation is deterministic', () => {
    const text1 = `High View Apartments Notice\n  CRLF \r\n Details text  `;
    const text2 = `High View Apartments Notice\n CRLF \n Details text`;
    expect(computePassageFingerprint(text1)).toBe(computePassageFingerprint(text2));
  });

  it('16. parses single question header "Question 147 refers to..."', () => {
    const text = `Question 147 refers to the following notice.\n\nText...\n\n147. Q147?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res[0].startQuestion).toBe(147);
    expect(res[0].endQuestion).toBe(147);
    expect(res[0].questionNumbers).toEqual([147]);
  });

  it('17. parses multiple consecutive groups from single text chunk', () => {
    const text = `Questions 147-148 refer to notice.\n\n147. Q1?\n(A) a\n148. Q2?\n(A) a\n\nQuestions 149-151 refer to email.\n\n149. Q3?\n(A) a\n150. Q4?\n(A) a\n151. Q5?\n(A) a`;
    const res = parsePart7StructureFromText(text);
    expect(res.length).toBe(2);
    expect(res[0].startQuestion).toBe(147);
    expect(res[1].startQuestion).toBe(149);
  });
});
