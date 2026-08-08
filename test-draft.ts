import { parseRawToeicTest } from './src/lib/toeic/classifier/classifyToeicTest';
import { classifyGroups } from './src/lib/toeic/classifier/groupClassifier';

const rawTest = `
PART 7

Questions 147-149 refer to the following email.

To: All Employees
From: Human Resources
Subject: Training Session

A customer-service training session will be held next Monday at 9:00 A.M.
in Conference Room B. Employees should arrive ten minutes early and bring
their employee identification cards.

147. When will the training session take place?
(A) This Friday
(B) Next Monday
(C) Next Tuesday
(D) Next month

148. Where will the session be held?
(A) Conference Room A
(B) Conference Room B
(C) The cafeteria
(D) The main lobby

149. What should employees bring?
(A) A laptop
(B) A printed schedule
(C) An identification card
(D) A training manual
`;

const draft = parseRawToeicTest(rawTest, { title: 'T', slug: 't', test_code: 't', description: '', test_type: 'full' });
console.log(JSON.stringify(draft.groups, null, 2));
