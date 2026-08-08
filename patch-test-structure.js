import fs from 'fs';

const filePath = 'src/lib/toeic/testStructure.ts';
let code = fs.readFileSync(filePath, 'utf-8');

const newFunc = `export function getPartSummary(questions: Array<{ part: string; question_number: number; is_active?: boolean }>) {
  const activeQs = questions.filter((q) => q.is_active === true);

  const summary: Record<string, { count: number; expected: number; isComplete: boolean; missing: number[] }> = {
    part1: { count: 0, expected: 6, isComplete: false, missing: [] },
    part2: { count: 0, expected: 25, isComplete: false, missing: [] },
    part3: { count: 0, expected: 39, isComplete: false, missing: [] },
    part4: { count: 0, expected: 30, isComplete: false, missing: [] },
    part5: { count: 0, expected: 30, isComplete: false, missing: [] },
    part6: { count: 0, expected: 16, isComplete: false, missing: [] },
    part7: { count: 0, expected: 54, isComplete: false, missing: [] },
  };

  const activeByPart: Record<string, Set<number>> = {
    part1: new Set(), part2: new Set(), part3: new Set(),
    part4: new Set(), part5: new Set(), part6: new Set(), part7: new Set()
  };

  activeQs.forEach((q) => {
    const norm = normalizeToeicPart(q.part);
    if (activeByPart[norm]) {
      activeByPart[norm].add(q.question_number);
    }
  });

  CANONICAL_TOEIC_PARTS.forEach((partKey) => {
    const s = summary[partKey as string];
    const activeSet = activeByPart[partKey as string];
    s.count = activeSet.size;
    
    const range = TOEIC_FULL_TEST_STRUCTURE[partKey];
    for (let i = range.startNumber; i <= range.endNumber; i++) {
      if (!activeSet.has(i)) {
        s.missing.push(i);
      }
    }
    s.isComplete = s.count === s.expected && s.missing.length === 0;
  });

  return summary;
}
`;

code = code.replace(/export function getPartSummary[\s\S]*?return summary;\n}/, newFunc);
fs.writeFileSync(filePath, code);
