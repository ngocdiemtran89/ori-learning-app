import fs from 'fs';

const filePath = 'src/lib/toeic/classifier/questionParser.ts';
let code = fs.readFileSync(filePath, 'utf-8');

// We need to parse inline options.
// Actually, a simpler way is to split `questionText` if it contains `(A)` or `A.` etc, but that's complex.
// Let's use a regex to extract inline options if they are all on the first line.
const newCode = `export interface ExtractedQuestionData {
  questionNumber: number;
  questionText: string | null;
  options: string[];
}

const QUESTION_NUMBER_REGEX = /^(?:(?:Question\\s+|Q)(\\d{1,3})[\\.\\)]?\\s*(.*)|(\\d{1,3})[\\.\\)]\\s+(.*))$/is;
const OPTION_REGEX = /^[\\(\\[]?([A-D])[\\.\\)\\]]\\s+(.*)$/i;
// Regex for inline options: matches "(A) text (B) text (C) text" optionally with D
const INLINE_OPTIONS_REGEX = /\\s*[\\(\\[]A[\\.\\)\\]]\\s+(.*?)\\s+[\\(\\[]B[\\.\\)\\]]\\s+(.*?)\\s+[\\(\\[]C[\\.\\)\\]]\\s+(.*?)(?:\\s+[\\(\\[]D[\\.\\)\\]]\\s+(.*))?$/i;

export function parseQuestionBlock(textBlock: string): ExtractedQuestionData | null {
  const lines = textBlock.split('\\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const firstLine = lines[0];
  const qMatch = firstLine.match(QUESTION_NUMBER_REGEX);
  
  if (!qMatch) {
    return null;
  }

  const questionNumberStr = qMatch[1] || qMatch[3];
  const qText = qMatch[2] || qMatch[4] || '';

  const questionNumber = parseInt(questionNumberStr, 10);
  if (isNaN(questionNumber) || questionNumber < 1 || questionNumber > 200) {
    return null;
  }

  let questionText = qText.trim();
  const options: string[] = [];

  // Check for inline options in the question text
  const inlineMatch = questionText.match(INLINE_OPTIONS_REGEX);
  if (inlineMatch) {
    options.push(\`(A) \${inlineMatch[1].trim()}\`);
    options.push(\`(B) \${inlineMatch[2].trim()}\`);
    options.push(\`(C) \${inlineMatch[3].trim()}\`);
    if (inlineMatch[4]) {
      options.push(\`(D) \${inlineMatch[4].trim()}\`);
    }
    // Remove the inline options from the question text
    questionText = questionText.replace(INLINE_OPTIONS_REGEX, '').trim();
  }

  // Parse remaining lines
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const optMatch = line.match(OPTION_REGEX);
    
    if (optMatch) {
      options.push(\`(\${optMatch[1].toUpperCase()}) \${optMatch[2].trim()}\`);
    } else {
      if (options.length === 0) {
        questionText = questionText ? questionText + ' ' + line : line;
      } else {
        options[options.length - 1] += ' ' + line;
      }
    }
  }

  if (questionText.length === 0) {
    questionText = null as any;
  }

  return {
    questionNumber,
    questionText,
    options
  };
}
`;

fs.writeFileSync(filePath, newCode);
