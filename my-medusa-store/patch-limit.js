const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.mjs') || fullPath.endsWith('.cjs') || fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;

            if (content.includes('1048576')) {
                content = content.replace(/1048576/g, '15728640');
                changed = true;
            }
            if (content.includes('1024 * 1024')) {
                content = content.replace(/1024 \* 1024/g, '15 * 1024 * 1024');
                changed = true;
            }
            if (content.includes('"1MB"')) {
                content = content.replace(/"1MB"/g, '"15MB"');
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(fullPath, content);
                console.log(`Patched ${fullPath}`);
            }
        }
    }
}

replaceInDir(path.resolve(__dirname, 'node_modules/@medusajs/dashboard'));
console.log('Patch complete.');
