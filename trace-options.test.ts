import fs from 'fs';
import { parseRawToeicTest } from './src/lib/toeic/classifier/classifyToeicTest.ts';
import { buildToeicTestRpcPayload } from './src/lib/supabase/adminToeicClassifier.ts';

const rawText = fs.readFileSync('full-test-mock.txt', 'utf-8');

const draft = parseRawToeicTest(rawText, {
  title: 'Test',
  slug: 'test',
  test_code: 'TEST',
  description: 'Test',
  test_type: 'full'
});

const qNums = [1, 7, 32, 71, 101, 131, 147, 177];

console.log('--- A & B: Parser / Classifier Draft ---');
qNums.forEach(n => {
  const q = draft.questions.find(x => x.question_number === n);
  console.log(`Q${n}:`, q ? q.options : 'Missing');
});

const payload = buildToeicTestRpcPayload(draft);

console.log('\n--- D: RPC Payload ---');
qNums.forEach(n => {
  const q = payload.questionsPayload.find(x => x.question_number === n);
  console.log(`Q${n}:`, q ? q.options : 'Missing');
});
