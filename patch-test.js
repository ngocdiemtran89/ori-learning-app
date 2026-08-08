import fs from 'fs';

const filePath = 'src/lib/toeic/classifier/completeness.test.ts';
let code = fs.readFileSync(filePath, 'utf-8');

code = code.replace(
  /\/\/ Options must never be empty in the payload![\s\S]+?expect\(q152\?\.options\[0\]\)\.toBe\(''\);/,
  `// Options must not be padded! Q150 has inline, Q151 has lines, Q152 has inline.
    expect(q150?.options.length).toBe(4);
    expect(q151?.options.length).toBe(4);
    expect(q152?.options.length).toBe(4);

    expect(q152?.options[0]).toBe('(A) 1');`
);

fs.writeFileSync(filePath, code);
