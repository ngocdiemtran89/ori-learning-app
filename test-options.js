import { parseRawToeicTest } from './dist/lib/toeic/classifier/classifyToeicTest.js';
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
`;

const draft = parseRawToeicTest(rawText, {
  title: 'Test',
  slug: 'test',
  test_code: 'TEST',
  description: 'Test',
  test_type: 'full'
});

console.log(draft.questions.map(q => ({ num: q.question_number, opts: q.options })));
