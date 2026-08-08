import fs from 'fs';

const filePath = 'src/lib/toeic/classifier/classifyToeicTest.ts';
let code = fs.readFileSync(filePath, 'utf-8');

// We need to add a preprocessing step before splitting by \n\s*\n
// Replace:
// const blocks = normalizedText.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
// With:
// const preprocessedText = normalizedText.replace(/^(?:Question\s+|Q)?\d{1,3}[\.\)]\s/gim, '\n\n$&');
// const blocks = preprocessedText.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);

code = code.replace(
  /const blocks = normalizedText\.split\(\/\\n\\s\*\\n\/\)\.map\(b => b\.trim\(\)\)\.filter\(Boolean\);/,
  `// Ensure questions are separated into different blocks even if there are no blank lines
  const preprocessedText = normalizedText.replace(/^(?:Question\\s+|Q)?\\d{1,3}[\\.\\)]\\s/gim, '\\n\\n$&');
  const blocks = preprocessedText.split(/\\n\\s*\\n/).map(b => b.trim()).filter(Boolean);`
);

fs.writeFileSync(filePath, code);
