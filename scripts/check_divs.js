const fs = require('fs');
const s = fs.readFileSync('./app/components/GradeManager.tsx','utf8');
const lines = s.split(/\r?\n/);
let stack = 0;
for (let i = 0; i < lines.length; i++) {
  const ln = lines[i];
  const opens = (ln.match(/<div\b/g) || []).length;
  const closes = (ln.match(/<\/div>/g) || []).length;
  if (opens || closes) {
    stack += opens - closes;
    console.log(`${i+1}: +${opens} -${closes} => ${stack} | ${ln}`);
  }
}
console.log('final stack=', stack);
