// Builds ../index.html: regenerates the drawings from the reference surface and inlines them into the template.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const svgDir = path.join(__dirname, 'svg');
execFileSync(process.execPath, [path.join(__dirname, 'svg.js'), svgDir], { stdio: 'inherit' });
let html = fs.readFileSync(path.join(__dirname, 'doc.template.html'), 'utf8');
html = html.replace(/<!--svg:(\w+)-->/g, (_, n) => fs.readFileSync(path.join(svgDir, n + '.svg'), 'utf8').replace(' xmlns="http://www.w3.org/2000/svg"', ''));
fs.writeFileSync(path.join(__dirname, '..', 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' KB');
