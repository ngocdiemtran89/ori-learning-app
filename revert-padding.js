import fs from 'fs';

const filePath = 'src/lib/toeic/classifier/classifyToeicTest.ts';
let code = fs.readFileSync(filePath, 'utf-8');

code = code.replace(
  /options: options\.length > 0 \? options : \(expectedPart === 'part2' \? \['', '', ''\] : \['', '', '', ''\]\),/,
  `options,`
);

fs.writeFileSync(filePath, code);
