const fs = require('fs');

let appContent = fs.readFileSync('src/App.jsx', 'utf8');

if (!appContent.includes('const [activeMobileTab, setActiveMobileTab]')) {
  appContent = appContent.replace(
    "const [gameState, setGameState] = useState('LANDING');",
    "const [gameState, setGameState] = useState('LANDING');\n  const [activeMobileTab, setActiveMobileTab] = useState('draw');"
  );
}

fs.writeFileSync('src/App.jsx', appContent);
console.log("Updated App.jsx with activeMobileTab");
