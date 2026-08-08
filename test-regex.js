const passage = `DOCUMENT 1 - EMAIL
This is the email content.
Multi line.
DOCUMENT 2 - NOTICE
This is the notice content.
DOCUMENT 3 - SCHEDULE
This is schedule content.`;

const docPattern = /(?:^|\n)DOCUMENT\s+\d+\s*-\s*([^\n]+)\n([\s\S]*?)(?=(?:\nDOCUMENT\s+\d+\s*-)|$)/gi;
const matches = [...passage.matchAll(docPattern)];
console.log(matches.map(m => ({ title: m[1].trim(), content: m[2].trim() })));
