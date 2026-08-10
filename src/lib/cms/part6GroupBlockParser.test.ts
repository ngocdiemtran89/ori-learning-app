import { describe, it, expect } from 'vitest';
import { parsePart6GroupBlock } from './part6GroupBlockParser';

describe('Part 6 Group-Level Block Parser Suite', () => {
  const sampleGroupText = `PASSAGE:
Look to Riessler Landscaping for your Garden Needs

Riessler Landscaping has everything you need to create your dream garden.
We will listen to your ideas and offer suggestions that match your gardening desires.
------- 131. The nursery here at Riessler Landscaping includes plants...
------- 132. to your garden. We are...
------- 133. equipped to construct small ponds...
------- 134. expertise is unmatched.

131.
(A) Staff members have written articles for the local newspaper.
(B) Installing lights can enhance the effect of a well-designed garden.
(C) Local competitors cannot beat the prices we charge.
(D) Riessler Landscaping’s goal is to make your vision a reality.

132.
(A) years
(B) space
(C) beauty
(D) moisture

133.
(A) also
(B) rarely
(C) somehow
(D) nevertheless

134.
(A) its
(B) our
(C) others
(D) their`;

  it('1. parses exact TOEIC Part 6 group text (passage + 4 options per question)', () => {
    const res = parsePart6GroupBlock(sampleGroupText, 131, 134);

    expect(res.passage).toContain('Look to Riessler Landscaping');
    expect(res.passage).toContain('------- 131.');
    expect(res.passage).toContain('------- 134.');

    expect(res.questions.length).toBe(4);
    expect(res.questions.map(q => q.question_number)).toEqual([131, 132, 133, 134]);

    expect(res.questions[0].options[0]).toBe('Staff members have written articles for the local newspaper.');
    expect(res.questions[0].options[3]).toBe('Riessler Landscaping’s goal is to make your vision a reality.');

    expect(res.questions[1].options).toEqual(['years', 'space', 'beauty', 'moisture']);
    expect(res.missingQuestionNumbers.length).toBe(0);
  });

  it('2. ensures surrounding sentences remain in passage and questionText is omitted', () => {
    const textWithSentences = `The office will be ------- 131. on Saturday.\n\n131.\n(A) closed\n(B) close\n(C) closing\n(D) closure\n`;
    const res = parsePart6GroupBlock(textWithSentences, 131, 134);

    expect(res.passage).toBe('The office will be ------- 131. on Saturday.');
    const q131 = res.questions.find(q => q.question_number === 131);
    expect(q131).toBeDefined();
    expect(q131).not.toHaveProperty('questionText');
    expect(q131?.options).toEqual(['closed', 'close', 'closing', 'closure']);
  });

  it('3. handles partial parse and identifies missing question numbers', () => {
    const partialText = `Passage content...\n\n131.\n(A) a\n(B) b\n(C) c\n(D) d\n\n134.\n(A) a\n(B) b\n(C) c\n(D) d\n`;
    const res = parsePart6GroupBlock(partialText, 131, 134);

    expect(res.questions.length).toBe(2);
    expect(res.questions.map(q => q.question_number)).toEqual([131, 134]);
    expect(res.missingQuestionNumbers).toEqual([132, 133]);
  });
});
