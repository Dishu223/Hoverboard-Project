const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');
s = s.replace(/io\.to\(([^)]+)\)\.emit\('room_update',\s*\{\s*players:\s*(room|currentRoom)\.players[\s\S]*?\}\);/g, (match, p1, p2) => {
  return `io.to(${p1}).emit('room_update', getSanitizedRoom(${p2}));`;
});
fs.writeFileSync('server.js', s);
console.log('Fixed emits');
