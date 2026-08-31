const fs = require('fs');
let c = fs.readFileSync('src/subscribers/order-placed.ts', 'utf8');
c = c.replace(/\\\$/g, '$');
c = c.replace(/\\`/g, '`');
fs.writeFileSync('src/subscribers/order-placed.ts', c);
