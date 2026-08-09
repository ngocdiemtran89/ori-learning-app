export function parseAnswerKey(text: string): Record<number, string> {
  const answers: Record<number, string> = {};
  
  // Sometimes they are space separated e.g. "1 A 2 B 3 C", which split by \s+ gives "1", "A", "2", "B"
  // Wait, the regex expects the line to be "1 A". If we split by \s+ it won't match.
  // Better approach: use a global regex over the whole string, or normalize it first.
  
  // Find occurrences of number followed optionally by punctuation and a letter A-D optionally in punctuation.
  const GLOBAL_ANSWER_REGEX = /\b(\d{1,3})[\s\.\-\):]*[\(\[]?([A-D])[\.\)\]]?\b/gi;
  
  const matches = [...text.matchAll(GLOBAL_ANSWER_REGEX)];
  
  for (const match of matches) {
    const qNum = parseInt(match[1], 10);
    const ans = match[2].toUpperCase();
    
    // For standard TOEIC, correct answers are prefixed like "(A) Option Text"
    // So the correct_answer field stores "(A) Option Text". 
    // However, the answer key parser just gives "A", "B", "C", "D".
    // We will return the raw letter 'A', 'B', 'C', 'D' here. 
    // The classifier will need to map it to the actual option text in the options array.
    
    if (qNum >= 1 && qNum <= 200) {
      answers[qNum] = ans;
    }
  }
  
  return answers;
}
