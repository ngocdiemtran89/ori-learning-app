import fs from 'fs';

const filePath = 'src/lib/toeic/classifier/classifyToeicTest.ts';
let code = fs.readFileSync(filePath, 'utf-8');

code = code.replace(
  /\/\/ Ensure questions are separated into different blocks even if there are no blank lines\n  const preprocessedText = normalizedText\.replace\(\/\^\(\?:Question\\\\s\+\|Q\)\?\\\\d\{1,3\}\[\\\\\\.\\\\\)\]\\\\s\/gim, '\\\\n\\\\n\$&'\);\n  const blocks = preprocessedText\.split\(\/\\\\n\\\\s\*\\\\n\/\)\.map\(b => b\.trim\(\)\)\.filter\(Boolean\);/,
  `const blocks = normalizedText.split(/\\n\\s*\\n/).map(b => b.trim()).filter(Boolean);`
);

fs.writeFileSync(filePath, code);
