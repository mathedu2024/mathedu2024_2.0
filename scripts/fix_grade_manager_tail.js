const fs = require('fs');
const p = './app/components/GradeManager.tsx';
let s = fs.readFileSync(p,'utf8');
const target = '\n\n\n  </div>\n      )}\n    </div>\n  );\n}';
if (s.includes(target)){
  s = s.replace(target, '\n\n\n  </div>\n  </div>\n      )}\n    </div>\n  );\n}');
  fs.writeFileSync(p,s,'utf8');
  console.log('patched tail successfully');
} else {
  console.log('target not found');
}
