const fs = require('fs');
const s = fs.readFileSync('./app/components/GradeManager.tsx','utf8');
const lines = s.split(/\r?\n/);
const stack = [];
for (let i = 0; i < lines.length; i++) {
  const ln = lines[i];
  let pos = 0;
  while (true) {
    const open = ln.indexOf('<div', pos);
    const close = ln.indexOf('</div>', pos);
    if (open === -1 && close === -1) break;
    if (open !== -1 && (close === -1 || open < close)) {
      stack.push({ line: i+1, text: ln.trim() });
      pos = open + 4;
    } else if (close !== -1) {
      if (stack.length === 0) {
        console.log('extra close at', i+1, ln.trim());
      } else {
        stack.pop();
      }
      pos = close + 6;
    }
  }
}
if (stack.length) {
  console.log('Unclosed <div> entries:');
  stack.forEach(x => console.log(x.line + ': ' + x.text));
} else console.log('All closed');
