const text = `
PART 2

7. Question 7
(A) A
(B) B
(C) C

PART 5

101. Question 101
`;
const headingPattern = /^[\s\-\*]*(PART\s+(?:[1-7]|I{1,3}V?|VI{1,2}|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN)).*$/gim;
const normalizedText = text.replace(headingPattern, '\n\n$1\n\n');
console.log(JSON.stringify(normalizedText));
