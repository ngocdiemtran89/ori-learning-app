import { ParsedQuestion, ParsedGroup } from './types';
import { v4 as uuidv4 } from 'uuid';

export function classifyGroups(questions: ParsedQuestion[]): ParsedGroup[] {
  const groups: ParsedGroup[] = [];
  let tempKeyCounter = 1;

  const getNewKey = (part: string) => `${part}-group-${tempKeyCounter++}-${uuidv4().substring(0, 8)}`;

  // Part 1: One group per question (photo)
  const p1Qs = questions.filter(q => q.part === 'part1');
  for (const q of p1Qs) {
    const key = getNewKey('part1');
    groups.push({
      group_temp_key: key,
      part: 'part1',
      group_type: 'photo',
      title: null,
      instruction: null,
      passage: null,
      transcript: null,
      audio_url: null,
      image_url: null,
      documents: []
    });
    q.group_temp_key = key;
  }

  // Part 2: One group per question (question_response)
  const p2Qs = questions.filter(q => q.part === 'part2');
  for (const q of p2Qs) {
    const key = getNewKey('part2');
    groups.push({
      group_temp_key: key,
      part: 'part2',
      group_type: 'question_response',
      title: null,
      instruction: null,
      passage: null,
      transcript: null,
      audio_url: null,
      image_url: null,
      documents: []
    });
    q.group_temp_key = key;
  }

  // Part 3: Conversations (Triplet grouping 32-34, 35-37...)
  const p3Qs = questions.filter(q => q.part === 'part3').sort((a,b) => a.question_number - b.question_number);
  for (let i = 0; i < p3Qs.length; i += 3) {
    const chunk = p3Qs.slice(i, i + 3);
    const key = getNewKey('part3');
    groups.push({
      group_temp_key: key,
      part: 'part3',
      group_type: 'conversation',
      title: `Questions ${chunk[0].question_number}-${chunk[chunk.length-1].question_number}`,
      instruction: null,
      passage: null,
      transcript: null,
      audio_url: null,
      image_url: null,
      documents: []
    });
    chunk.forEach(q => q.group_temp_key = key);
  }

  // Part 4: Talks (Triplet grouping 71-73...)
  const p4Qs = questions.filter(q => q.part === 'part4').sort((a,b) => a.question_number - b.question_number);
  for (let i = 0; i < p4Qs.length; i += 3) {
    const chunk = p4Qs.slice(i, i + 3);
    const key = getNewKey('part4');
    groups.push({
      group_temp_key: key,
      part: 'part4',
      group_type: 'talk',
      title: `Questions ${chunk[0].question_number}-${chunk[chunk.length-1].question_number}`,
      instruction: null,
      passage: null,
      transcript: null,
      audio_url: null,
      image_url: null,
      documents: []
    });
    chunk.forEach(q => q.group_temp_key = key);
  }

  // Part 5: Standalone, no group
  const p5Qs = questions.filter(q => q.part === 'part5');
  p5Qs.forEach(q => q.group_temp_key = null);

  // Part 6: Text Completion (Quad grouping 131-134...)
  const p6Qs = questions.filter(q => q.part === 'part6').sort((a,b) => a.question_number - b.question_number);
  for (let i = 0; i < p6Qs.length; i += 4) {
    const chunk = p6Qs.slice(i, i + 4);
    const key = getNewKey('part6');
    groups.push({
      group_temp_key: key,
      part: 'part6',
      group_type: 'text_completion',
      title: `Questions ${chunk[0].question_number}-${chunk[chunk.length-1].question_number}`,
      instruction: null,
      passage: null, // Will be flagged for review later if empty
      transcript: null,
      audio_url: null,
      image_url: null,
      documents: []
    });
    chunk.forEach(q => q.group_temp_key = key);
  }

  // Part 7: Reading Comprehension
  // DO NOT blindly group using fixed ranges.
  // Because we do not currently parse explicit "Questions 147-149 refer to..." text boundaries
  // in this V1 parser, we MUST group them safely or flag them for review.
  // Strategy: Group ALL Part 7 questions into a single placeholder group marked for REVIEW.
  // The Admin must manually split them using the UI or provide explicit boundaries.
  
  const p7Qs = questions.filter(q => q.part === 'part7').sort((a,b) => a.question_number - b.question_number);
  
  if (p7Qs.length > 0) {
    const key = getNewKey('part7');
    groups.push({
      group_temp_key: key,
      part: 'part7',
      group_type: 'reading_set',
      title: `Part 7 (Cần review nhóm)`,
      instruction: 'REVIEW: Hệ thống chưa tự động nhận diện ranh giới đoạn văn. Vui lòng gộp/tách nhóm thủ công.',
      passage: null,
      transcript: null,
      audio_url: null,
      image_url: null,
      documents: []
    });
    p7Qs.forEach(q => q.group_temp_key = key);
  }

  return groups;
}
