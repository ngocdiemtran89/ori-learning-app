const text = `
PART 2

7. Question 7
(A) A
(B) B
(C) C

PART 5

101. Question 101
(A) A
(B) B
(C) C
(D) D
`;
const headingPattern = /^[\s\-\*]*(PART\s+(?:[1-7]|I{1,3}V?|VI{1,2}|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN)).*$/gim;
const normalizedText = text.replace(headingPattern, '$1\n\n');
const blocks = normalizedText.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
console.log(blocks);
