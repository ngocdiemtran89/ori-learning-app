import { describe, it, expect } from 'vitest';
import { parseRawToeicTest } from '../toeic/classifier/classifyToeicTest';
import { buildToeicTestRpcPayload } from './adminToeicClassifier';

describe('Admin TOEIC Classifier Integration', () => {
  it('correctly extracts double and triple structured documents for Part 7', () => {
    const rawText = `
PART 7

Questions 150-152 refer to the following e-mail and notice.

DOCUMENT 1 - EMAIL
This is the email.
DOCUMENT 2 - NOTICE
This is the notice.

150. What?
(A) 1
(B) 2
(C) 3
(D) 4
151. What?
(A) 1
(B) 2
(C) 3
(D) 4
152. What?
(A) 1
(B) 2
(C) 3
(D) 4

Questions 153-155 refer to the following advertisement, e-mail, and schedule.

DOCUMENT 1 - ADVERTISEMENT
Buy this!
DOCUMENT 2 - EMAIL
Sure!
DOCUMENT 3 - SCHEDULE
Tomorrow!

153. What?
(A) 1
(B) 2
(C) 3
(D) 4
154. What?
(A) 1
(B) 2
(C) 3
(D) 4
155. What?
(A) 1
(B) 2
(C) 3
(D) 4
`;

    const draft = parseRawToeicTest(rawText, {
      title: 'Test',
      slug: 'test',
      test_code: 'TEST',
      description: 'Test',
      test_type: 'full'
    });

    const payload = buildToeicTestRpcPayload(draft);
    const groups = payload.groupsPayload;

    expect(groups.length).toBe(2);

    const doubleGroup = groups.find(g => g.title === 'Questions 150-152');
    expect(doubleGroup).toBeDefined();
    expect(doubleGroup?.documents).toHaveLength(2);
    expect(doubleGroup?.documents[0].type).toBe('email');
    expect(doubleGroup?.documents[0].title).toBe('EMAIL');
    expect(doubleGroup?.documents[1].type).toBe('notice');
    expect(doubleGroup?.documents[1].title).toBe('NOTICE');
    expect(doubleGroup?.passage).toBeNull();

    const tripleGroup = groups.find(g => g.title === 'Questions 153-155');
    expect(tripleGroup).toBeDefined();
    expect(tripleGroup?.documents).toHaveLength(3);
    expect(tripleGroup?.documents[0].type).toBe('advertisement');
    expect(tripleGroup?.documents[0].title).toBe('ADVERTISEMENT');
    expect(tripleGroup?.documents[1].type).toBe('email');
    expect(tripleGroup?.documents[2].type).toBe('schedule');
    expect(tripleGroup?.passage).toBeNull();
  });
});
