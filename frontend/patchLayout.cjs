const fs = require('fs');

let content = fs.readFileSync('src/App.jsx', 'utf8');

const targetString = `<div className="game-room">`;
const newLayout = `<div className="game-room">
            {/* Desktop / Core Layout (hidden elements on mobile via CSS) */}
            <div className="core-layout-wrapper" style={{ display: 'flex', width: '100%', height: '100%' }}>`;

content = content.replace(targetString, newLayout);

const bottomNavString = `
            <div className="mobile-chat-layout" style={{ flex: 1, display: 'flex', minHeight: 0, gap: '8px' }}>`;

const bottomNavReplacement = `
            </div> {/* End of core-layout-wrapper */}

            {/* Mobile Bottom Navigation (Instagram Style) */}
            <div className="mobile-bottom-nav">
              <button className={activeMobileTab === 'draw' ? 'active' : ''} onClick={() => setActiveMobileTab('draw')}>
                <span className="icon">🖌️</span>
              </button>
              <button className={activeMobileTab === 'chat' ? 'active' : ''} onClick={() => setActiveMobileTab('chat')}>
                <span className="icon">💬</span>
              </button>
              <button className={activeMobileTab === 'players' ? 'active' : ''} onClick={() => setActiveMobileTab('players')}>
                <span className="icon">👥</span>
              </button>
              <button className={activeMobileTab === 'settings' ? 'active' : ''} onClick={() => setActiveMobileTab('settings')}>
                <span className="icon">⚙️</span>
              </button>
              <button 
                className="emoji-btn" 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <span className="icon">😀</span>
              </button>
            </div>

            {/* Bottom Sheet for Mobile */}
            <div className={\`bottom-sheet \${activeMobileTab !== 'draw' ? 'open' : ''}\`}>
              <div className="bottom-sheet-handle" onClick={() => setActiveMobileTab('draw')} />
              <div className="bottom-sheet-content">
                {activeMobileTab === 'chat' && (
                  <div className="mobile-chat-sheet" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
`;

content = content.replace(bottomNavString, bottomNavReplacement);

const reactionsString = `            <div className="mobile-reactions">
              {renderReactions()}
            </div>
            
            {renderStartButtonMobile()}
          </div>
        </div>
      </div>
    );
  }`;

const reactionsReplacement = `                )}
                {activeMobileTab === 'players' && (
                  <div className="mobile-players-sheet" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                     {renderPlayersList()}
                  </div>
                )}
                {activeMobileTab === 'settings' && (
                  <div className="mobile-settings-sheet" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
                    <h2 className="neon-text" style={{ margin: 0 }}>Settings</h2>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'var(--glass-bg)', borderRadius: '12px' }}>
                      <span style={{ fontWeight: 'bold' }}>Room Code:</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', color: 'var(--color-primary)' }}>{roomId}</span>
                    </div>
                    <button className="btn-secondary" onClick={toggleTheme} style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      {document.body.getAttribute('data-theme') === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
                    </button>
                    <button className="btn-secondary" onClick={handleLeaveRoom} style={{ padding: '16px', borderRadius: '12px', background: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold' }}>
                      🚪 Leave Game
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Vertical Emojis (Right side) */}
            {showEmojiPicker && (
               <div className="mobile-vertical-emojis">
                 <div className="mobile-reactions-vertical">
                   {renderReactions()}
                 </div>
               </div>
            )}
            
            {renderStartButtonMobile()}
          </div>
        </div>
      </div>
    );
  }`;

content = content.replace(reactionsString, reactionsReplacement);

// Fix the renderReactions to not have absolute positioning that goes offscreen in mobile
content = content.replace(
  `{showEmojiPicker && (
        <div className="card emoji-picker-popup" style={{ position: 'absolute', bottom: 'calc(100% + 10px)', right: '0', zIndex: 100, padding: '12px', border: '1px solid var(--color-primary)', display: 'flex', flexWrap: 'wrap', gap: '8px', width: 'max-content', maxWidth: '300px' }}>`,
  `{showEmojiPicker && (
        <div className="card emoji-picker-popup" style={{ zIndex: 100, padding: '12px', border: '1px solid var(--color-primary)', display: 'flex', flexWrap: 'wrap', gap: '8px', width: 'max-content', maxWidth: '300px' }}>`
);

fs.writeFileSync('src/App.jsx', content);
console.log("App.jsx layout patched.");
