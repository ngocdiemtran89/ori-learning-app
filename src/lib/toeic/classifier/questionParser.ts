export interface ExtractedQuestionData {
  questionNumber: number;
  questionText: string | null;
  options: string[];
}

// Regex to capture question numbers: "1.", "1)", "Question 1", "Q1", "101.", "147)"
// To prevent arbitrary numbers from being parsed (e.g. "15 people"), we require punctuation or the explicit word "Question"/"Q"
const QUESTION_NUMBER_REGEX = /^(?:(?:Question\s+|Q)(\d{1,3})[\.\)]?\s*(.*)|(\d{1,3})[\.\)]\s+(.*))$/is;
const OPTION_REGEX = /^[\(\[]?([A-D])[\.\)\]]\s+(.*)$/i;

export function parseQuestionBlock(textBlock: string): ExtractedQuestionData | null {
  const lines = textBlock.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const firstLine = lines[0];
  const qMatch = firstLine.match(QUESTION_NUMBER_REGEX);
  
  if (!qMatch) {
    return null; // Not a recognized question block start
  }

  const questionNumberStr = qMatch[1] || qMatch[3];
  const qText = qMatch[2] || qMatch[4] || '';

  const questionNumber = parseInt(questionNumberStr, 10);
  if (isNaN(questionNumber) || questionNumber < 1 || questionNumber > 200) {
    return null; // Out of range for a full test
  }

  let questionText = qText.trim() || null;
  const options: string[] = [];

  // Parse remaining lines for options or continuation of question text
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const optMatch = line.match(OPTION_REGEX);
    
    if (optMatch) {
      // It's an option. Store it normalized as (A) text
      options.push(`(${optMatch[1].toUpperCase()}) ${optMatch[2].trim()}`);
    } else {
      // If we haven't found options yet, maybe it's continuation of question text
      if (options.length === 0) {
        questionText = questionText ? questionText + ' ' + line : line;
      } else {
        // Option continuation or anomalous text
        options[options.length - 1] += ' ' + line;
      }
    }
  }

  // If question text is empty, ensure it's literally null
  if (questionText && questionText.trim().length === 0) {
    questionText = null;
  }

  return {
    questionNumber,
    questionText,
    options
  };
}
