import fs from 'fs';

let content = '';
content += 'PART 1\n\n';
for (let i = 1; i <= 6; i++) {
  content += `${i}. Photo question\n(A) 1\n(B) 2\n(C) 3\n(D) 4\n\n`;
}
content += 'PART 2\n\n';
for (let i = 7; i <= 31; i++) {
  content += `${i}. Question response\n(A) 1\n(B) 2\n(C) 3\n\n`;
}
content += 'PART 3\n\n';
for (let i = 32; i <= 70; i += 3) {
  content += `Questions ${i}-${i+2} refer to the following conversation.\n\n`;
  for(let j = i; j <= i+2; j++) {
    content += `${j}. Question\n(A) 1\n(B) 2\n(C) 3\n(D) 4\n\n`;
  }
}
content += 'PART 4\n\n';
for (let i = 71; i <= 100; i += 3) {
  content += `Questions ${i}-${i+2} refer to the following talk.\n\n`;
  for(let j = i; j <= i+2; j++) {
    content += `${j}. Question\n(A) 1\n(B) 2\n(C) 3\n(D) 4\n\n`;
  }
}
content += 'PART 5\n\n';
for (let i = 101; i <= 130; i++) {
  content += `${i}. Incomplete sentence\n(A) 1\n(B) 2\n(C) 3\n(D) 4\n\n`;
}
content += 'PART 6\n\n';
for (let i = 131; i <= 146; i += 4) {
  content += `Questions ${i}-${i+3} refer to the following text.\nPassage\n\n`;
  for(let j = i; j <= i+3; j++) {
    content += `${j}. Question\n(A) 1\n(B) 2\n(C) 3\n(D) 4\n\n`;
  }
}
content += 'PART 7\n\n';
for (let i = 147; i <= 200; i += 2) { // just arbitrary sizes
  content += `Questions ${i}-${i+1 > 200 ? 200 : i+1} refer to the following passage.\nPassage\n\n`;
  for(let j = i; j <= (i+1 > 200 ? 200 : i+1); j++) {
    content += `${j}. Question\n(A) 1\n(B) 2\n(C) 3\n(D) 4\n\n`;
  }
}

fs.writeFileSync('full-test-mock.txt', content);
