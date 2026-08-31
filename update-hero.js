const fs = require('fs');
const file = 'my-medusa-store/src/subscribers/order-placed.ts';
let content = fs.readFileSync(file, 'utf8');

const startTag = '      <!-- Order Status Confirmed';
const endTag = '      <!-- Products Table -->';
const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
    const newHero = `      <!-- Order Status Confirmed (Hero Redesign with BUKUR Logo) -->
      <div style="padding: 40px 20px; text-align: center; background: \${BRAND_COLOR};">
        <div style="margin: 0 auto 15px;">
          <!-- Using the provided Bukur logo -->
          <img src="https://0x0.st/Pe9C.png" alt="Bukur Logo" style="width: 70px; height: auto; border-radius: 50%;" />
        </div>
        <h2 style="margin: 0 0 10px 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Faleminderit!</h2>
        <h3 style="margin: 0; color: #eff6ff; font-size: 18px; font-weight: 500;">Porosia juaj u konfirmua me sukses.</h3>
        <p style="margin: 10px 0 0 0; color: #bfdbfe; font-size: 14px;">Shumë shpejt një agjent do t'ju kontaktojë për dorëzimin.</p>
      </div>

`;
    content = content.substring(0, startIndex) + newHero + content.substring(endIndex);
    fs.writeFileSync(file, content);
    console.log('Replaced hero successfully');
} else {
    console.log('Could not find tags');
}
