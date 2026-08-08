import fs from 'fs';

const filePath = 'src/lib/toeic/classifier/questionParser.ts';
let code = fs.readFileSync(filePath, 'utf-8');

code = code.replace(
  /if \(options.length === 0\) \{/,
  `if (line.match(QUESTION_NUMBER_REGEX)) break;
      if (options.length === 0) {`
);

fs.writeFileSync(filePath, code);
