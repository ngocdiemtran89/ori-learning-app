import fs from 'fs';

const filePath = 'src/lib/toeic/classifier/classifyToeicTest.ts';
let code = fs.readFileSync(filePath, 'utf-8');

code = code.replace(
  /const blocks = normalizedText\.split\(\/\\n\\s\*\\n\/\)\.map\(b => b\.trim\(\)\)\.filter\(Boolean\);/,
  `// Ensure questions are separated into different blocks even if there are no blank lines
  const preprocessedText = normalizedText.replace(/\\n(?=(?:Question\\s+|Q)?\\d{1,3}[\\.\\)]\\s)/gi, '\\n\\n');
  const blocks = preprocessedText.split(/\\n\\s*\\n/).map(b => b.trim()).filter(Boolean);`
);

fs.writeFileSync(filePath, code);
