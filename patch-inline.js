import fs from 'fs';

const filePath = 'src/lib/toeic/classifier/questionParser.ts';
let code = fs.readFileSync(filePath, 'utf-8');

const regexes = `const QUESTION_NUMBER_REGEX = /^(?:(?:Question\\s+|Q)(\\d{1,3})[\\.\\)]?\\s*(.*)|(\\d{1,3})[\\.\\)]\\s+(.*))$/is;
const OPTION_REGEX = /^[\\(\\[]?([A-D])[\\.\\)\\]]\\s+(.*)$/i;
const INLINE_OPTIONS_REGEX = /(?:\\s+)[\\(\\[]?A[\\.\\)\\]]\\s+(.*?)(?:\\s+)[\\(\\[]?B[\\.\\)\\]]\\s+(.*?)(?:\\s+)[\\(\\[]?C[\\.\\)\\]]\\s+(.*?)(?:(?:\\s+)[\\(\\[]?D[\\.\\)\\]]\\s+(.*))?$/i;
`;

code = code.replace(/const QUESTION_NUMBER_REGEX = [^\n]+\nconst OPTION_REGEX = [^\n]+\n/, regexes);

const extractInline = `
  let questionText = qText.trim() || null;
  const options: string[] = [];

  // Check inline options in question text
  if (questionText) {
    const inlineMatch = questionText.match(INLINE_OPTIONS_REGEX);
    if (inlineMatch) {
      options.push(\`(A) \${inlineMatch[1].trim()}\`);
      options.push(\`(B) \${inlineMatch[2].trim()}\`);
      options.push(\`(C) \${inlineMatch[3].trim()}\`);
      if (inlineMatch[4]) {
        options.push(\`(D) \${inlineMatch[4].trim()}\`);
      }
      questionText = questionText.replace(INLINE_OPTIONS_REGEX, '').trim();
    }
  }
`;

code = code.replace(/  let questionText = qText\.trim\(\) \|\| null;\n  const options: string\[\] = \[\];\n/, extractInline);

fs.writeFileSync(filePath, code);
