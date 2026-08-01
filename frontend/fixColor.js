const fs = require('fs');

let f = fs.readFileSync('src/components/CanvasBoard.jsx', 'utf8');
f = f.replace(/useState\('random'\)/, "useState('#1d1d1d')");
fs.writeFileSync('src/components/CanvasBoard.jsx', f);

let a = fs.readFileSync('src/App.jsx', 'utf8');
a = a.replace(/useState\('random'\)/, "useState('#1d1d1d')");
fs.writeFileSync('src/App.jsx', a);

console.log("Default color updated.");
