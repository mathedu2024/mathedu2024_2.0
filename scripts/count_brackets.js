const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node count_brackets.js <file>'); process.exit(2); }
const s = fs.readFileSync(path, 'utf8');
const counts = { '{':0, '}':0, '(':0, ')':0, '[':0, ']':0, '<':0, '>':0 };
for (const ch of s) { if (counts.hasOwnProperty(ch)) counts[ch]++; }
console.log('Counts:', counts);
// Show surrounding lines for reported positions
const lines = s.split(/\r?\n/);
[1165,1302,1429].forEach(n => {
  const i = n-1;
  if (i >= 0 && i < lines.length) {
    console.log('\n--- around line', n, '---');
    for (let j = Math.max(0,i-3); j <= Math.min(lines.length-1,i+3); j++) {
      console.log((j+1).toString().padStart(5)+':', lines[j]);
    }
  }
});
