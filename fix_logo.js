const fs = require('fs');
const file = 'c:/Users/HP/OneDrive/Desktop/bukur1/my-medusa-store/src/subscribers/order-placed.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /<!-- Using the provided Bukur logo -->[\s\S]*?<\/div>(\s*)<h2 style="margin/;
const replacement = `<!-- Using the provided Bukur logo -->
          <img src="https://iili.io/qAgqQMG.png" alt="Bukur Logo" style="width: 100px; height: auto;" />
        </div>$1<h2 style="margin`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log('Replaced base64 logo with iili.io URL');
