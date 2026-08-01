const fs = require('fs');
const css = `
/* --- Mobile UI Overhaul (Instagram Style Navigation) --- */
@media (max-width: 768px) {
  .core-layout-wrapper {
    flex-direction: column;
    padding-bottom: 70px; /* Space for bottom nav */
  }

  .desktop-sidebar, .desktop-reactions, .desktop-only-start {
    display: none !important;
  }

  .mobile-bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    border-top: 1px solid var(--glass-border);
    display: flex;
    justify-content: space-around;
    align-items: center;
    z-index: 1000;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
  }

  .mobile-bottom-nav button {
    background: none;
    border: none;
    font-size: 1.5rem;
    padding: 10px;
    border-radius: 50%;
    color: var(--color-text-muted);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    cursor: pointer;
  }

  .mobile-bottom-nav button.active {
    color: var(--color-primary);
    transform: translateY(-4px);
  }

  .mobile-bottom-nav button.active::after {
    content: '';
    position: absolute;
    bottom: 0px;
    left: 50%;
    transform: translateX(-50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-primary);
    box-shadow: 0 0 8px var(--color-primary);
  }

  /* Bottom Sheets */
  .bottom-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 85dvh;
    background: var(--bg-color);
    border-top-left-radius: 24px;
    border-top-right-radius: 24px;
    box-shadow: 0 -10px 40px rgba(0,0,0,0.3);
    z-index: 999;
    transform: translateY(100%);
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    pointer-events: none;
  }

  .bottom-sheet.open {
    transform: translateY(0);
    pointer-events: auto;
  }

  .bottom-sheet-handle {
    width: 100%;
    height: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: grab;
  }

  .bottom-sheet-handle::after {
    content: '';
    width: 40px;
    height: 5px;
    background: var(--color-text-muted);
    border-radius: 10px;
    opacity: 0.5;
  }

  .bottom-sheet-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    padding-bottom: 80px; /* clear bottom nav */
  }

  /* Vertical Emojis */
  .mobile-vertical-emojis {
    position: fixed;
    bottom: 75px;
    right: 16px;
    z-index: 1001;
    animation: slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .mobile-reactions-vertical .reaction-buttons-wrapper {
    flex-direction: column-reverse; /* Pop upwards */
    gap: 8px;
    background: var(--glass-bg);
    padding: 8px;
    border-radius: 30px;
    backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border);
  }

  /* Compact Toolbar on Mobile */
  .main-board > div > div:first-child {
    /* Target the toolbar container inside CanvasBoard */
    padding: 8px 12px !important;
    gap: 8px !important;
    border-radius: 16px !important;
  }
  
  .color-btn {
    width: 24px !important;
    height: 24px !important;
  }
  
  .main-board select.input {
    padding: 4px 8px !important;
    font-size: 0.75rem !important;
  }
  
  .main-board button.btn-secondary, .main-board button.btn-primary {
    padding: 4px 10px !important;
    font-size: 0.75rem !important;
  }

  /* Chat Input Fix for Keyboard */
  .mobile-chat-sheet {
    min-height: 0;
  }
}

@media (min-width: 769px) {
  .mobile-bottom-nav, .bottom-sheet, .mobile-vertical-emojis {
    display: none !important;
  }
}

@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(20px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
`;
fs.appendFileSync('src/index.css', css);
console.log("Appended CSS");
