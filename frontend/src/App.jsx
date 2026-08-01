import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Send, Eraser, Camera, Moon, Sun, LogOut, Menu, X } from 'lucide-react';
import { toPng } from 'html-to-image';
import { playSFX } from './audio';
import confetti from 'canvas-confetti';
import './App.css';
import { CanvasBoard } from './components/CanvasBoard';
const BACKEND_URL = import.meta.env.PROD ? window.location.origin : "http://localhost:3001";
const socket = io(BACKEND_URL);

function MiniAvatar({ avatar, size = 24 }) {
  if (!avatar) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', width: size, height: size, flexShrink: 0, border: '1px solid var(--color-primary)' }}>
      {avatar.map((color, i) => (
        <div key={i} style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}

function AvatarCreator({ avatar, setAvatar }) {
  const [color, setColor] = useState('#F472B6');
  const [isMouseDown, setIsMouseDown] = useState(false);

  const randomize = () => {
    const newAvatar = Array(64).fill('#ffffff');
    const colors = ['#F472B6', '#C084FC', '#38BDF8', '#34D399', '#FBBF24', '#ffffff', '#1e293b'];
    for(let i=0; i<64; i++) {
      if(Math.random() > 0.6) {
        newAvatar[i] = colors[Math.floor(Math.random() * colors.length)];
      }
    }
    setAvatar(newAvatar);
  };

  const handlePaint = (idx) => {
    const newAvatar = [...avatar];
    newAvatar[idx] = color;
    setAvatar(newAvatar);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      <label style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '0.9rem' }}>Draw your Avatar!</label>
      <div 
        className="touch-drawing"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', width: '128px', height: '128px', border: '2px solid var(--color-primary)', cursor: 'crosshair', touchAction: 'none' }}
        onMouseDown={() => setIsMouseDown(true)}
        onMouseUp={() => setIsMouseDown(false)}
        onMouseLeave={() => setIsMouseDown(false)}
      >
        {avatar.map((c, i) => (
          <div 
            key={i} 
            style={{ backgroundColor: c, border: '1px solid rgba(0,0,0,0.05)' }} 
            onMouseDown={() => handlePaint(i)}
            onMouseEnter={() => { if(isMouseDown) handlePaint(i); }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: '32px', height: '32px', padding: 0, cursor: 'pointer' }} title="Pick Color" />
        <button type="button" className="btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={randomize}>Randomize</button>
        <button type="button" className="btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setAvatar(Array(64).fill('#ffffff'))}>Clear</button>
      </div>
    </div>
  );
}

function App() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState('LANDING');
  const [activeMobileTab, setActiveMobileTab] = useState('draw'); // LANDING, INTRO, ROOM
  const [username, setUsername] = useState(() => localStorage.getItem('hoverboard_username') || '');
  const [roomId, setRoomId] = useState('');
  const [avatar, setAvatar] = useState(() => {
    try {
      const stored = localStorage.getItem('hoverboard_avatar');
      return stored ? JSON.parse(stored) : Array(64).fill('#ffffff');
    } catch(e) { return Array(64).fill('#ffffff'); }
  });
  const [isSpectator, setIsSpectator] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  
  // Settings State
  const [settings, setSettings] = useState({ 
    maxPlayers: 10, 
    categories: ['animals', 'food', 'objects'], 
    canvasType: 'hoverboard',
    timeLimit: 60, 
    wordSelectionTime: 30,
    customDrawMode: false,
    allowRepeatingWords: false,
    penaltyOnWrongGuess: false,
    customWords: '',
    maxRounds: 6,
    mutators: {
      enabled: false,
      symmetry: false,
      blindfold: false,
      upsideDown: false
    }
  });
  
  // Room State
  const [room, setRoom] = useState({ players: [], state: 'WAITING' });
  const [chat, setChat] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [artistName, setArtistName] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [wordHint, setWordHint] = useState('');
  const [activeMutator, setActiveMutator] = useState('none');
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [reactions, setReactions] = useState([]);
  const ALL_EMOJIS = ['❤️', '😂', '😮', '🤔', '🔥', '🎉', '🤡', '💀', '😭', '👀', '👍', '👎', '✨', '💯', '💩', '😎'];
  const [myEmojis, setMyEmojis] = useState(['❤️', '😂', '😮', '🤔', '🔥', '🎉']);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [wordSelection, setWordSelection] = useState(null); // { words: [], shufflesRemaining: 3, customDrawMode: boolean }
  const [customDrawWord, setCustomDrawWord] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const chatContainerRef = useRef(null);

  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('room_update', (data) => {
      // Sort players by score descending (Leaderboard functionality)
      if (data.players) {
        data.players.sort((a, b) => b.score - a.score);
      }
      setRoom(data);
    });

    newSocket.on('score_update', (updates) => {
      setRoom(prev => {
        if (!prev) return prev;
        const newPlayers = prev.players.map(p => {
          const update = updates.find(u => u.id === p.id);
          return update ? { ...p, score: update.score } : p;
        });
        newPlayers.sort((a, b) => b.score - a.score);
        return { ...prev, players: newPlayers };
      });
    });

    newSocket.on('room_reaction', (emoji) => {
      // Spawn 4 to 8 floating emojis per click for dramatic effect
      const count = Math.floor(Math.random() * 5) + 4;
      const newReactions = [];
      for (let i = 0; i < count; i++) {
        const id = Date.now() + Math.random() + i;
        const x = 10 + Math.random() * 80;
        newReactions.push({ id, emoji, x });
        
        setTimeout(() => {
          setReactions((prev) => prev.filter(r => r.id !== id));
        }, 2000 + Math.random() * 500); // randomize fade out slightly
      }
      setReactions((prev) => [...prev, ...newReactions]);
    });
    
    newSocket.on('kicked', () => {
      alert("You have been kicked from the room by vote.");
      setGameState('LANDING');
      setRoom({ players: [], state: 'WAITING' });
      setChat([]);
    });

    newSocket.on('chat_message', (msg) => {
      setChat((prev) => [...prev, msg]);
      if (msg.system && msg.text.includes('guessed the word')) {
        playSFX('guess');
        // trigger fireworks if it was THIS user who guessed
        const usernameWithoutTrim = username || localStorage.getItem('hoverboard_username');
        if (usernameWithoutTrim && msg.text.includes(usernameWithoutTrim)) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
      } else if (!msg.system) {
        playSFX('chat');
      }
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    });

    newSocket.on('round_start', (data) => {
      setArtistName(data.artistName);
      setWordHint('');
      setActiveMutator(data.activeMutator || 'none');
      playSFX('round_start');
      setChat((prev) => [...prev, { system: true, text: `Round started! ${data.artistName} is drawing.` }]);
    });

    newSocket.on('word_selection_start', (data) => {
      setWordSelection(data);
    });

    newSocket.on('your_word', (word) => {
      setCurrentWord(word);
      setWordSelection(null);
    });
    
    newSocket.on('word_hint', (hint) => {
      setWordHint(hint);
      setWordSelection(null);
    });

    newSocket.on('word_to_draw', (word) => {
      setCurrentWord(word);
      setWordSelection(null);
    });

    newSocket.on('round_end', (data) => {
      setChat((prev) => [...prev, { system: true, text: `Round ended! The word was: ${data.word}` }]);
      setCurrentWord('');
      setArtistName('');
      setWordHint('');
      setTimeLeft(0);
    });

    newSocket.on('timer_update', (time) => {
      setTimeLeft(time);
      if (time > 0 && time <= 10) {
        playSFX('tick');
      }
    });

    return () => newSocket.close();
  }, []);

  const handleJoin = (e, targetRoomId = roomId) => {
    if (e) e.preventDefault();
    if (!username.trim() || !targetRoomId.trim()) return;
    
    localStorage.setItem('hoverboard_username', username.trim());
    localStorage.setItem('hoverboard_avatar', JSON.stringify(avatar));

    socket.emit('join_room', { username: username.trim(), roomId: targetRoomId, avatar, isSpectator }, (res) => {
      if (res.success) {
        setRoomId(res.roomId);
        setGameState('ROOM');
        localStorage.setItem('hoverboard_room_id', res.roomId);
        localStorage.setItem('hoverboard_join_time', Date.now().toString());
      } else {
        alert(res.error);
        localStorage.removeItem('hoverboard_room_id');
      }
    });
  };

  const handleRejoin = () => {
    const savedRoomId = localStorage.getItem('hoverboard_room_id');
    const joinTime = localStorage.getItem('hoverboard_join_time');
    
    if (savedRoomId && joinTime && (Date.now() - parseInt(joinTime)) < 60000) {
      setRoomId(savedRoomId);
      // artificially call handleJoin with the saved room ID
      handleJoin(null, savedRoomId);
    }
  };

  const handleCreateBtn = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setGameState('INTRO');
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    localStorage.setItem('hoverboard_username', username.trim());
    localStorage.setItem('hoverboard_avatar', JSON.stringify(avatar));

    socket.emit('create_room', { username: username.trim(), settings: { ...settings, avatar, isSpectator } }, (res) => {
      if (res.success) {
        setRoomId(res.roomId);
        setGameState('ROOM');
        localStorage.setItem('hoverboard_room_id', res.roomId);
        localStorage.setItem('hoverboard_join_time', Date.now().toString());
      } else {
        alert(res.error);
      }
    });
  };

  const handleStartGame = () => {
    socket.emit('start_game');
  };

  const handleLeaveRoom = () => {
    socket.emit('leave_room');
    setGameState('LANDING');
    setRoom({ players: [], state: 'WAITING' });
    setChat([]);
    localStorage.removeItem('hoverboard_room_id');
  };

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    if (newTheme) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  };

  const myPlayerInfo = room.players.find(p => p.id === socket?.id);
  const isArtist = myPlayerInfo?.isArtist;

  const renderPlayersList = () => (
    <>
      <h4 style={{ marginBottom: '8px', color: 'var(--color-secondary)' }}>Players</h4>
      <ul className="player-list">
        {room.players.map((p, i) => (
          <li key={i} className={`player-item ${p.isArtist ? 'is-artist' : ''}`} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
               <MiniAvatar avatar={p.avatar} />
               <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                 {p.username} {p.id === socket?.id ? '(You)' : ''} {p.isSpectator ? '👁️' : ''}
               </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>{p.score}</span>
              {p.id !== socket?.id && (
                <button 
                  className="btn-secondary" 
                  style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                  onClick={() => socket.emit('votekick', p.id)}
                  title="Vote Kick"
                >
                  Kick
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      
      {room.state === 'WAITING' && room.players[0]?.id === socket?.id && (
        <button className="btn-primary desktop-only-start" onClick={handleStartGame} style={{ marginTop: 'auto' }}>Start Game</button>
      )}
      {room.state === 'WAITING' && room.players[0]?.id !== socket?.id && (
        <div className="desktop-only-start" style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: 'auto' }}>Waiting for host...</div>
      )}
    </>
  );

  const renderStartButtonMobile = () => {
    if (room.state !== 'WAITING') return null;
    if (room.players[0]?.id === socket?.id) {
      return (
        <button className="btn-primary mobile-only-start" onClick={handleStartGame} style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 100, padding: '12px 24px', fontSize: '1.2rem', boxShadow: 'var(--shadow-lg)' }}>
          Start Game
        </button>
      );
    } else {
      return (
        <div className="mobile-only-start" style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 100, background: 'var(--glass-bg)', padding: '8px 16px', borderRadius: '12px', fontWeight: 'bold' }}>
          Waiting for host...
        </div>
      );
    }
  };

  const renderReactions = () => (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="reaction-buttons-wrapper">
        {myEmojis.map(emoji => (
          <button 
            key={emoji}
            className="btn-secondary" 
            style={{ fontSize: '1.5rem', padding: '8px', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => socket.emit('reaction', emoji)}
            title={`Send ${emoji} reaction`}
          >
            {emoji}
          </button>
        ))}
        <button 
          className="btn-primary" 
          style={{ fontSize: '1.5rem', padding: '8px', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="Customize Emojis"
        >
          +
        </button>
      </div>
      {showEmojiPicker && (
        <div className="card emoji-picker-popup" style={{ position: 'absolute', bottom: 'calc(100% + 10px)', right: '0', zIndex: 100, padding: '12px', border: '1px solid var(--color-primary)', display: 'flex', flexWrap: 'wrap', gap: '8px', width: 'max-content', maxWidth: '300px' }}>
          <div style={{ width: '100%', textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-primary)', marginBottom: '8px', fontWeight: 'bold' }}>Select up to 6 emojis</div>
          {ALL_EMOJIS.map(emoji => {
            const isSelected = myEmojis.includes(emoji);
            return (
              <button
                key={emoji}
                className={isSelected ? "btn-primary" : "btn-secondary"}
                style={{ fontSize: '1.2rem', padding: '6px 10px', borderRadius: '8px' }}
                onClick={() => {
                  if (isSelected) {
                    setMyEmojis(prev => prev.filter(e => e !== emoji));
                  } else {
                    if (myEmojis.length < 6) {
                      setMyEmojis(prev => [...prev, emoji]);
                    } else {
                      alert("You can only select up to 6 emojis. Deselect one first.");
                    }
                  }
                }}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (gameState === 'ROOM') {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', width: '100%', boxSizing: 'border-box' }}>
          
          {/* Top Bar */}
          <div className="top-bar">
            <div className="top-bar-left">
              <h2 className="neon-text" style={{ fontSize: '1.8rem', margin: 0 }}>Lumynati</h2>
              <div className="mobile-hidden" style={{ background: 'rgba(255,255,255,0.8)', color: 'var(--color-primary)', padding: '6px 16px', borderRadius: '12px', fontWeight: 'bold', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                Room Code: <span style={{ fontFamily: 'monospace', letterSpacing: '1px', fontSize: '1.3rem' }}>{roomId}</span>
              </div>
            </div>
            
            <div className="top-bar-center">
              <div style={{ fontWeight: 'bold', fontSize: '1.4rem', color: 'var(--color-primary)', textAlign: 'center' }}>
                {room.state === 'WAITING' ? 'Waiting Area' : (isArtist ? <span>Draw: <span style={{ color: 'white', background: 'var(--color-primary)', padding: '4px 12px', borderRadius: '12px', letterSpacing: '2px', textTransform: 'uppercase', boxShadow: '0 0 10px var(--color-primary)' }}>{currentWord}</span></span> : (wordHint ? `Hint: ${wordHint}` : `Guess what ${artistName} is drawing!`))}
                {activeMutator !== 'none' && room.state === 'DRAWING' && (
                  <span style={{ marginLeft: '12px', fontSize: '1rem', color: '#ef4444', background: '#fef2f2', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fca5a5' }}>
                    Chaos: {activeMutator === 'symmetry' ? 'Symmetry' : activeMutator === 'blindfold' ? 'Blindfold' : 'Upside Down'}
                  </span>
                )}
              </div>
              
              {room.state === 'DRAWING' && (
                <div className={timeLeft <= 15 ? 'timer-warning-anim' : ''} style={{ 
                  background: timeLeft <= 15 ? '#ef4444' : 'var(--glass-bg)', 
                  color: timeLeft <= 15 ? 'white' : 'var(--color-primary)', 
                  padding: '6px 20px', 
                  borderRadius: '20px', 
                  fontWeight: '900', 
                  fontSize: '1.5rem',
                  boxShadow: timeLeft <= 15 ? '0 0 20px rgba(239,68,68,0.8)' : 'none',
                  transition: 'all 0.3s'
                }}>
                  ⏱ {timeLeft}s
                </div>
              )}
            </div>

            <div className="top-bar-right mobile-hidden">
              <button className="btn-secondary" onClick={toggleTheme} style={{ padding: '8px', borderRadius: '50%' }} title="Toggle Theme">
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button className="btn-secondary" onClick={handleLeaveRoom} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: '#ef4444', color: 'white', border: 'none' }} title="Leave Room">
                <LogOut size={16} />
              </button>
            </div>
            
            <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} color="var(--color-primary)" />
            </button>
          </div>
          
          {isMobileMenuOpen && (
            <div className="mobile-menu-overlay">
              <div className="mobile-menu-content card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 className="neon-text" style={{ fontSize: '1.5rem', margin: 0 }}>Menu</h2>
                  <button className="btn-secondary" onClick={() => setIsMobileMenuOpen(false)} style={{ padding: '8px', borderRadius: '50%' }}>
                    <X size={20} />
                  </button>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px', background: 'var(--glass-bg)', borderRadius: '12px' }}>
                  <span style={{ fontWeight: 'bold' }}>Room Code:</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '1px', color: 'var(--color-primary)' }}>{roomId}</span>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <button className="btn-secondary" onClick={toggleTheme} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />} Theme
                  </button>
                  <button className="btn-secondary" onClick={handleLeaveRoom} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: '#ef4444', color: 'white', border: 'none' }}>
                    <LogOut size={16} /> Leave
                  </button>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {renderPlayersList()}
                </div>
              </div>
            </div>
          )}

          <div className="game-room">
            {/* Desktop / Core Layout (hidden elements on mobile via CSS) */}
            <div className="core-layout-wrapper" style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div className="sidebar card desktop-sidebar" style={{ padding: '16px' }}>
              {renderPlayersList()}
            </div>

            <div className="main-board" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
              
              {room.state === 'GAME_OVER' ? (
                <div className="card" style={{ textAlign: 'center', zIndex: 10 }}>
                  <h2 className="neon-text" style={{ fontSize: '3rem', marginBottom: '16px' }}>Game Over!</h2>
                  <h3 style={{ marginBottom: '24px' }}>Final Scores</h3>
                  <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[...room.players].sort((a, b) => b.score - a.score).map((p, i) => (
                      <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--glass-bg)', borderRadius: '12px', fontWeight: 'bold', fontSize: i === 0 ? '1.2rem' : '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '1.5rem' }}>{i === 0 ? '👑' : i + 1}</span>
                          <MiniAvatar avatar={p.avatar} />
                          {p.username}
                        </div>
                        <span>{p.score} pts</span>
                      </li>
                    ))}
                  </ul>
                  {room.players[0]?.id === socket?.id && (
                    <button className="btn-primary" onClick={handleStartGame}>Play Again</button>
                  )}
                </div>
              ) : (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  
                  {room.state === 'WORD_SELECTION' && (
                    <div className="round-overlay" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(10px)', border: '1px solid var(--color-primary)' }}>
                      {myPlayerInfo?.isArtist ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          {wordSelection?.customDrawMode ? (
                            <>
                              <h2 className="neon-text" style={{ fontSize: '2rem', marginBottom: '20px' }}>What will you draw?</h2>
                              <form onSubmit={(e) => { e.preventDefault(); if (customDrawWord.trim()) { socket.emit('select_word', { word: customDrawWord.trim() }); setCustomDrawWord(''); } }} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                                <input type="text" className="input" placeholder="Type a word..." value={customDrawWord} onChange={e => setCustomDrawWord(e.target.value)} autoFocus style={{ minWidth: '250px' }} />
                                <button type="submit" className="btn-primary" disabled={!customDrawWord.trim()}>Submit</button>
                              </form>
                            </>
                          ) : (
                            <>
                              <h2 className="neon-text" style={{ fontSize: '2rem', marginBottom: '20px' }}>Choose a word!</h2>
                              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {wordSelection?.words?.map((w) => (
                                  <button key={w} className="btn-primary" style={{ padding: '12px 24px', fontSize: '1.2rem' }} onClick={() => socket.emit('select_word', { word: w })}>
                                    {w}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                            <div className="countdown-number" style={{ fontSize: '2.5rem' }}>{room.timeRemaining}</div>
                            {!wordSelection?.customDrawMode && (
                              <button className="btn-secondary" style={{ padding: '12px 24px' }} disabled={wordSelection?.shufflesRemaining <= 0} onClick={() => socket.emit('shuffle_words')}>
                                Shuffle ({wordSelection?.shufflesRemaining} left)
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <h2 className="neon-text" style={{ fontSize: '2rem', marginBottom: '20px' }}>Artist is choosing a word...</h2>
                          <div className="countdown-number">{room.timeRemaining}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {room.settings?.canvasType === 'plain' ? (
                    <CanvasBoard socket={socket} isArtist={myPlayerInfo?.isArtist} isPlaying={room.state === 'DRAWING'} activeMutator={activeMutator} />
                  ) : (
                    <Hoverboard socket={socket} isArtist={myPlayerInfo?.isArtist} isPlaying={room.state === 'DRAWING'} activeMutator={activeMutator} canvasType={room.settings?.canvasType} />
                  )}
                  
                  {/* Floating Emojis */}
                {reactions.map((r) => (
                  <div key={r.id} className="floating-emoji" style={{ left: `${r.x}%`, bottom: '10%' }}>
                    {r.emoji}
                  </div>
                ))}
                
                <div className="desktop-reactions">
                  {renderReactions()}
                </div>
              </div>
              )}
            </div>

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
            <div className={`bottom-sheet ${activeMobileTab !== 'draw' ? 'open' : ''}`}>
              <div className="bottom-sheet-handle" onClick={() => setActiveMobileTab('draw')} />
              <div className="bottom-sheet-content">
                {activeMobileTab === 'chat' && (
                  <div className="mobile-chat-sheet" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

              <div className="sidebar card chat-sidebar" style={{ flex: 1 }}>
              <h4 style={{ marginBottom: '8px', color: 'var(--color-secondary)' }}>Chat ({roomId})</h4>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="chat-messages" ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {chat.map((m, i) => {
                    const isSystem = m.system;
                    const isMine = m.username === username;
                    const msgClass = isSystem ? `system ${m.type || ''}` : (isMine ? 'sent' : 'received');
                    
                    return (
                      <div key={i} className={`chat-msg ${msgClass}`} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: '8px' }}>
                        {!isSystem && m.avatar && <MiniAvatar avatar={m.avatar} size={20} />}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                          {!isSystem && <span className="username">{m.username}</span>}
                          <span>{m.text}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <ChatInput socket={socket} disabled={isArtist && room.state === 'DRAWING'} />
              </div>
            </div>
            
            <div className="mobile-reactions">
              {renderReactions()}
            </div>
            
            {renderStartButtonMobile()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="neon-text" style={{ fontSize: '3rem', marginBottom: '2rem', textAlign: 'center' }}>Lumynati</h1>
      
      {gameState === 'LANDING' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <button className="btn-secondary" style={{ position: 'absolute', top: '16px', right: '16px', borderRadius: '50%', padding: '12px', background: 'var(--glass-bg)' }} onClick={toggleTheme} title="Toggle Theme">
            {document.body.getAttribute('data-theme') === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="card">
          <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Enter the Grid</h2>
          {localStorage.getItem('hoverboard_room_id') && localStorage.getItem('hoverboard_join_time') && (Date.now() - parseInt(localStorage.getItem('hoverboard_join_time'))) < 60000 && (
            <button type="button" className="btn-primary" onClick={handleRejoin} style={{ marginBottom: '16px', background: '#10b981', color: 'white', width: '100%', padding: '12px', fontSize: '1.1rem' }}>
              Rejoin Match ({localStorage.getItem('hoverboard_room_id')})
            </button>
          )}
          <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <AvatarCreator avatar={avatar} setAvatar={setAvatar} />
            <input 
              type="text" 
              className="input" 
              placeholder="Your Nickname" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required
            />
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--color-text)', fontSize: '0.9rem', justifyContent: 'center' }}>
              <input type="checkbox" checked={isSpectator} onChange={(e) => setIsSpectator(e.target.checked)} />
              Join as Spectator (No drawing)
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="input" 
                style={{ flex: 1 }}
                placeholder="Room Code to Join" 
                value={roomId} 
                onChange={(e) => setRoomId(e.target.value)} 
              />
              <button type="button" className="btn-secondary" onClick={handleJoin} style={{ padding: '0 24px' }}>Join</button>
            </div>
            
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', margin: '8px 0' }}>— OR —</div>
            
            <button type="button" className="btn-primary" onClick={handleCreateBtn}>Create New Room</button>
          </form>
        </div>
        </div>
      )}

      {gameState === 'INTRO' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <button className="btn-secondary" style={{ position: 'absolute', top: '16px', right: '16px', borderRadius: '50%', padding: '12px', background: 'var(--glass-bg)' }} onClick={toggleTheme} title="Toggle Theme">
            {document.body.getAttribute('data-theme') === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="card" style={{ maxWidth: '800px', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Room Settings</h2>
          <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="intro-grid">
              
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Max Rounds</label>
              <select className="input" value={settings.maxRounds || 6} onChange={(e) => setSettings({...settings, maxRounds: parseInt(e.target.value)})}>
                <option value="2">2 Rounds</option>
                <option value="4">4 Rounds</option>
                <option value="6">6 Rounds</option>
                <option value="8">8 Rounds</option>
                <option value="10">10 Rounds</option>
                <option value="12">12 Rounds</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Max Players</label>
              <select className="input" value={settings.maxPlayers} onChange={(e) => setSettings({...settings, maxPlayers: parseInt(e.target.value)})}>
                <option value="2">2 Players</option>
                <option value="4">4 Players</option>
                <option value="6">6 Players</option>
                <option value="10">10 Players</option>
                <option value="20">20 Players</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Time Limit</label>
              <select className="input" value={settings.timeLimit} onChange={(e) => setSettings({...settings, timeLimit: parseInt(e.target.value)})}>
                <option value="30">30 Seconds</option>
                <option value="60">60 Seconds</option>
                <option value="90">90 Seconds</option>
                <option value="120">120 Seconds</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Selection Time</label>
              <select className="input" value={settings.wordSelectionTime} onChange={(e) => setSettings({...settings, wordSelectionTime: parseInt(e.target.value)})}>
                <option value="15">15 Seconds</option>
                <option value="30">30 Seconds</option>
                <option value="45">45 Seconds</option>
                <option value="60">60 Seconds</option>
              </select>
            </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Canvas Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button"
                    className={settings.canvasType === 'hoverboard' ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1, padding: '10px' }}
                    onClick={() => setSettings({...settings, canvasType: 'hoverboard'})}
                  >
                    Hoverboard (Pixel Grid)
                  </button>
                  <button 
                    type="button"
                    className={settings.canvasType === 'plain' ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1, padding: '10px' }}
                    onClick={() => setSettings({...settings, canvasType: 'plain'})}
                  >
                    Plain White (No Grid)
                  </button>
                </div>
              </div>
              
              </div>
              
              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                  <label style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Word Categories</label>
                  <button 
                    type="button"
                    className="input" 
                    style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => setCategoriesExpanded(!categoriesExpanded)}
                  >
                    {settings.categories.length} Selected
                    <span>{categoriesExpanded ? '▲' : '▼'}</span>
                  </button>
                  
                  {categoriesExpanded && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px var(--shadow-color)', maxHeight: '200px', overflowY: 'auto' }}>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        style={{ fontSize: '0.8rem', padding: '4px' }}
                        onClick={() => {
                          const allCats = ['animals', 'places', 'food', 'objects', 'nature', 'body', 'clothing', 'vehicles', 'sports', 'actions', 'custom'];
                          if (settings.categories.length === allCats.length) {
                            setSettings({...settings, categories: []});
                          } else {
                            setSettings({...settings, categories: allCats});
                          }
                        }}
                      >
                        {settings.categories.length === 11 ? 'Deselect All' : 'Select All'}
                      </button>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {['animals', 'places', 'food', 'objects', 'nature', 'body', 'clothing', 'vehicles', 'sports', 'actions', 'custom'].map(cat => (
                  <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="checkbox" 
                      checked={settings.categories.includes(cat)} 
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSettings(s => ({
                          ...s,
                          categories: checked ? [...s.categories, cat] : s.categories.filter(c => c !== cat)
                        }));
                      }} 
                    />
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </label>
                ))}
                      </div>
                    </div>
                  )}
                </div>
            
            {settings.categories.includes('custom') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Custom Words (Comma separated)</label>
                <textarea 
                  className="input" 
                  rows="3" 
                  placeholder="apple, banana, rocket ship, pizza..."
                  value={settings.customWords} 
                  onChange={(e) => setSettings({...settings, customWords: e.target.value})} 
                />
              </div>
            )}



            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', borderRadius: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: 'var(--color-primary)', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={settings.customDrawMode} 
                  onChange={(e) => setSettings({...settings, customDrawMode: e.target.checked})} 
                />
                Custom Draw Mode (Artist types their own word!)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: 'var(--color-primary)', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={settings.allowRepeatingWords} 
                  onChange={(e) => setSettings({...settings, allowRepeatingWords: e.target.checked})} 
                />
                Allow Repeating Words
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: 'var(--color-primary)', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={settings.penaltyOnWrongGuess} 
                  onChange={(e) => setSettings({...settings, penaltyOnWrongGuess: e.target.checked})} 
                />
                Penalty on Wrong Guess (-2 pts)
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', borderRadius: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: 'var(--color-primary)', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={settings.mutators.enabled} 
                  onChange={(e) => setSettings({...settings, mutators: {...settings.mutators, enabled: e.target.checked}})} 
                />
                Enable Mutators (Chaos Mode!)
              </label>
              
              {settings.mutators.enabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '24px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={settings.mutators.symmetry} onChange={(e) => setSettings({...settings, mutators: {...settings.mutators, symmetry: e.target.checked}})} />
                    Symmetry Mode (Mirrored Drawing)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={settings.mutators.blindfold} onChange={(e) => setSettings({...settings, mutators: {...settings.mutators, blindfold: e.target.checked}})} />
                    Blindfold Mode (Canvas hides after 5s)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="checkbox" checked={settings.mutators.upsideDown} onChange={(e) => setSettings({...settings, mutators: {...settings.mutators, upsideDown: e.target.checked}})} />
                    Upside Down Mode (Rotates Canvas)
                  </label>
                </div>
              )}
            </div>
            </div> {/* End Right Column */}
            </div> {/* End Grid */}

            <div style={{ display: 'flex', gap: '16px', marginTop: '1rem' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setGameState('LANDING')}>Back</button>
              <button type="submit" className="btn-primary" style={{ flex: 2 }}>Launch Game</button>
            </div>
          </form>
        </div>
        </div>
      )}
    </div>
  );
}

function ChatInput({ socket, disabled }) {
  const [msg, setMsg] = useState('');

  const send = (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    socket.emit('send_message', msg);
    setMsg('');
  };

  return (
    <form onSubmit={send} style={{ display: 'flex', gap: '8px' }}>
      <input 
        type="text" 
        className="input" 
        style={{ flex: 1 }} 
        placeholder={disabled ? "Artists can't guess!" : "Type guess..."}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        disabled={disabled}
      />
      <button type="submit" className="btn-primary" style={{ padding: '8px' }} disabled={disabled}>
        <Send size={18} />
      </button>
    </form>
  );
}

// Highly Optimized Vanilla-style Grid Component inside React
function Hoverboard({ socket, isArtist, isPlaying, activeMutator, canvasType }) {
  const containerRef = useRef(null);
  const squaresRef = useRef([]);
  const hoverBufferRef = useRef([]);
  const SQUARES_COUNT = 4800; // 80 cols x 60 rows for wide rectangle
  const COLS = 80;
  const ROWS = 60;
  
  // Drawing options state
  const [selectedColor, setSelectedColor] = useState('#1d1d1d');
  const [customColor, setCustomColor] = useState('#000000');
  const [isPermanent, setIsPermanent] = useState(true);
  const [drawMode, setDrawMode] = useState('click'); // 'hover', 'click', or 'none'
  const [activeTool, setActiveTool] = useState('brush'); // 'brush', 'eraser', 'fill'
  const [brushSize, setBrushSize] = useState(1); // 1, 3, 5
  const [canOverwrite, setCanOverwrite] = useState(true);
  const [isBlindfolded, setIsBlindfolded] = useState(false);
  
  const isMouseDownRef = useRef(false);
  const boardStateRef = useRef(new Array(SQUARES_COUNT).fill('rgba(255, 255, 255, 0.7)'));
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  // Cute pastel palette with names
  const colors = [
    { name: 'Pastel Pink', hex: '#FF9CEE' },
    { name: 'Pastel Purple', hex: '#C5A3FF' },
    { name: 'Pastel Blue', hex: '#B5B9FF' },
    { name: 'Cyan', hex: '#85E3FF' },
    { name: 'Pastel Green', hex: '#BFFCC6' },
    { name: 'Pastel Yellow', hex: '#FFFFD1' },
    { name: 'Peach', hex: '#FFDFD3' },
    { name: 'Magenta', hex: '#F6A6FF' },
    { name: 'Red', hex: '#FF4949' },
    { name: 'Orange', hex: '#FF9B49' },
    { name: 'Green', hex: '#13CE66' },
    { name: 'Blue', hex: '#1FB6FF' },
    { name: 'Brown', hex: '#8B4513' },
    { name: 'Black', hex: '#1d1d1d' },
    { name: 'White', hex: '#FFFFFF' }
  ];

  // Use refs to avoid stale closures in vanilla event listeners
  const isArtistRef = useRef(isArtist);
  const isPlayingRef = useRef(isPlaying);
  const optsRef = useRef({ selectedColor, isPermanent, drawMode, activeTool, brushSize, canOverwrite, activeMutator });

  useEffect(() => {
    isArtistRef.current = isArtist;
    isPlayingRef.current = isPlaying;
    optsRef.current = { selectedColor, isPermanent, drawMode, activeTool, brushSize, canOverwrite, activeMutator };
  }, [isArtist, isPlaying, selectedColor, isPermanent, drawMode, activeTool, brushSize, canOverwrite, activeMutator]);

  useEffect(() => {
    if (activeMutator === 'blindfold' && isPlaying && isArtist) {
      const timer = setTimeout(() => {
        setIsBlindfolded(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setIsBlindfolded(false);
    }
  }, [activeMutator, isPlaying, isArtist]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isArtistRef.current || !isPlayingRef.current) return;
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isArtist, isPlaying]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initialize Grid only once
    if (containerRef.current.children.length === 0) {
      for (let i = 0; i < SQUARES_COUNT; i++) {
        const square = document.createElement('div');
        square.classList.add('square');
        // Removed hardcoded width/height to let CSS handle flex sizing
        
        containerRef.current.appendChild(square);
        squaresRef.current.push(square);

        // Add event listeners directly to DOM elements for performance
        square.addEventListener('mouseover', () => handleHover(i));
        square.addEventListener('mousedown', () => handleHover(i, true));
        // Touch support directly mapped to indices
        square.addEventListener('touchstart', (e) => {
           e.preventDefault();
           isMouseDownRef.current = true;
           handleHover(i, true);
        }, { passive: false });
      }
      
      const handleTouchMove = (e) => {
        if (!isMouseDownRef.current) return;
        e.preventDefault();
        const touch = e.touches[0];
        const elem = document.elementFromPoint(touch.clientX, touch.clientY);
        if (elem && elem.classList.contains('square')) {
          const index = squaresRef.current.indexOf(elem);
          if (index !== -1) handleHover(index, false);
        }
      };

      const saveState = () => {
        undoStackRef.current.push([...boardStateRef.current]);
        if (undoStackRef.current.length > 30) undoStackRef.current.shift();
        redoStackRef.current = [];
      };

      containerRef.current.addEventListener('touchmove', handleTouchMove, { passive: false });
      containerRef.current.addEventListener('touchend', () => { isMouseDownRef.current = false; });
      
      containerRef.current.addEventListener('mousedown', () => { saveState(); isMouseDownRef.current = true; });
      containerRef.current.addEventListener('mouseup', () => { isMouseDownRef.current = false; });
      containerRef.current.addEventListener('mouseleave', () => { isMouseDownRef.current = false; });
      containerRef.current.addEventListener('mouseenter', () => {
        if (optsRef.current.drawMode === 'hover') saveState();
      });
    }

    // Socket listeners for remote drawing
    const onDraw = (data) => {
      if (data.hoverTuples) {
        data.hoverTuples.forEach(tuple => {
          const [indices, color, isPerm] = tuple;
          indices.forEach(idx => setColor(squaresRef.current[idx], color, isPerm, idx));
        });
      } else if (data.indices) { // Fallback for old unbatched events
        const { indices, color, isPerm } = data;
        indices.forEach(idx => setColor(squaresRef.current[idx], color, isPerm, idx));
      }
    };

    const onClear = () => {
      squaresRef.current.forEach((sq, idx) => {
        sq.style.transitionDuration = '0s';
        const def = 'rgba(255, 255, 255, 0.7)';
        sq.style.background = def;
        boardStateRef.current[idx] = def;
      });
      undoStackRef.current = [];
      redoStackRef.current = [];
    };

    const onBoardState = (state) => {
      boardStateRef.current = [...state];
      squaresRef.current.forEach((sq, idx) => {
        sq.style.background = state[idx];
      });
    };

    socket?.on('draw_batch', onDraw);
    socket?.on('clear_board', onClear);
    socket?.on('board_state', onBoardState);
    
    const onRequestBoardState = () => {
      if (isArtist && isPlaying) {
        socket.emit('board_state', boardStateRef.current);
      }
    };
    socket?.on('request_board_state', onRequestBoardState);

    return () => {
      socket?.off('draw_batch', onDraw);
      socket?.off('clear_board', onClear);
      socket?.off('board_state', onBoardState);
      socket?.off('request_board_state', onRequestBoardState);
    };
  }, [socket, isArtist, isPlaying]);

  useEffect(() => {
    const flushInterval = setInterval(() => {
      if (hoverBufferRef.current.length > 0 && socket && isArtist && isPlaying) {
        socket.emit('draw_batch', { hoverTuples: hoverBufferRef.current, isHoverboard: true });
        hoverBufferRef.current = [];
      }
    }, 50);
    return () => clearInterval(flushInterval);
  }, [socket, isArtist, isPlaying]);

  const handleSnapshot = () => {
    if (containerRef.current) {
      playSFX('chat'); // camera click sound
      toPng(containerRef.current, { cacheBust: true, backgroundColor: '#ffffff' })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = `hover-guess-${Date.now()}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.error('Snapshot failed', err);
        });
    }
  };

  const handleUndo = () => {
    if (undoStackRef.current.length === 0) return;
    redoStackRef.current.push([...boardStateRef.current]);
    const prevState = undoStackRef.current.pop();
    boardStateRef.current = [...prevState];
    squaresRef.current.forEach((sq, idx) => sq.style.background = prevState[idx]);
    socket.emit('board_state', prevState);
  };

  const handleRedo = () => {
    if (redoStackRef.current.length === 0) return;
    undoStackRef.current.push([...boardStateRef.current]);
    const nextState = redoStackRef.current.pop();
    boardStateRef.current = [...nextState];
    squaresRef.current.forEach((sq, idx) => sq.style.background = nextState[idx]);
    socket.emit('board_state', nextState);
  };

  const handleHover = (index, isClick = false) => {
    if (!isArtistRef.current || !isPlayingRef.current) return;
    const { drawMode, selectedColor, isPermanent, activeTool, brushSize, canOverwrite, activeMutator } = optsRef.current;
    
    if (drawMode === 'none') return;
    
    if (drawMode === 'click') {
      if (!isClick && !isMouseDownRef.current) return;
    }
    
    let color = selectedColor === 'random' ? getRandomColor() : selectedColor;
    
    if (activeTool === 'eraser') {
       color = 'rgba(255, 255, 255, 0.7)';
    }

    if (activeTool === 'fill' && isClick) {
       undoStackRef.current.push([...boardStateRef.current]);
       const targetColor = boardStateRef.current[index];
       if (targetColor === color) return;
       
       const queue = [index];
       const visited = new Set([index]);
       const filled = [];
       
       while (queue.length > 0) {
         const curr = queue.shift();
         filled.push(curr);
         const r = Math.floor(curr / COLS);
         const c = curr % COLS;
         
         const neighbors = [[r-1, c], [r+1, c], [r, c-1], [r, c+1]];
         for (const [nr, nc] of neighbors) {
           if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
             const nIdx = nr * COLS + nc;
             if (!visited.has(nIdx) && boardStateRef.current[nIdx] === targetColor) {
               visited.add(nIdx);
               queue.push(nIdx);
             }
           }
         }
       }
       
       filled.forEach(idx => setColor(squaresRef.current[idx], color, true, idx));
       hoverBufferRef.current.push([filled, color, true]);
       return;
    }

    // Brush Tool Logic
    if (activeTool === 'brush' || activeTool === 'eraser') {
       const indicesToDraw = [];
       const r = Math.floor(index / COLS);
       const c = index % COLS;
       const offset = Math.floor(brushSize / 2);
       
       for (let i = -offset; i <= offset; i++) {
         for (let j = -offset; j <= offset; j++) {
           const nr = r + i;
           const nc = c + j;
           if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
             const sqIdx = nr * COLS + nc;
             
             // Overwrite logic check
             const isDefault = boardStateRef.current[sqIdx] === 'rgba(255, 255, 255, 0.7)';
             if (activeTool === 'eraser' || canOverwrite || isDefault) {
               indicesToDraw.push(sqIdx);
               
               if (activeMutator === 'symmetry') {
                 const mirrorC = COLS - 1 - nc;
                 indicesToDraw.push(nr * COLS + mirrorC);
               }
             }
           }
         }
       }
       
       indicesToDraw.forEach(idx => setColor(squaresRef.current[idx], color, isPermanent, idx));
       hoverBufferRef.current.push([indicesToDraw, color, isPermanent]);
     }
  };

  const setColor = (element, color, isPerm, index) => {
    if (!element) return;
    element.style.transitionDuration = '0s'; // Instant paint
    element.style.background = color;
    boardStateRef.current[index] = color;
    
    if (!isPerm) {
      setTimeout(() => {
        removeColor(element, index);
      }, 2000);
    }
  };

  const removeColor = (element, index) => {
    if (!element) return;
    element.style.transitionDuration = ''; // Restore CSS transition (2s fade out)
    const def = 'rgba(255, 255, 255, 0.7)';
    element.style.background = def;
    boardStateRef.current[index] = def;
  };

  const getRandomColor = () => {
    return colors[Math.floor(Math.random() * colors.length)].hex;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', flex: 1, minHeight: 0 }}>
      {isArtist && isPlaying && (
        <div className="artist-toolbar">
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>Color:</span>
              <select className="input" style={{ padding: '6px 12px', fontSize: '0.9rem', minWidth: '120px' }} value={selectedColor} onChange={(e) => { setSelectedColor(e.target.value); setActiveTool('brush'); }}>
                 <option value="random">Random Cute</option>
                 {colors.map(c => <option key={c.name} value={c.hex} style={{ background: c.hex, color: c.hex === '#FFFFFF' || c.hex === '#FFFFD1' ? '#333' : '#fff' }}>{c.name}</option>)}
              </select>
              <input 
                 type="color" 
                 value={customColor} 
                 onChange={(e) => {
                    setCustomColor(e.target.value);
                    setSelectedColor(e.target.value);
                    setActiveTool('brush');
                 }} 
                 style={{ border: 'none', background: 'transparent', cursor: 'pointer', width: '32px', height: '32px', padding: 0 }} 
                 title="Choose Custom Color"
              />
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>Style:</span>
              <button className={isPermanent ? "btn-primary" : "btn-secondary"} style={{ padding: '6px 16px', fontSize: '0.8rem' }} onClick={() => setIsPermanent(true)}>Permanent</button>
              <button className={!isPermanent ? "btn-primary" : "btn-secondary"} style={{ padding: '6px 16px', fontSize: '0.8rem' }} onClick={() => setIsPermanent(false)}>Trail</button>
           </div>

           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>Draw Mode:</span>
              <button className={drawMode === 'hover' ? "btn-primary" : "btn-secondary"} style={{ padding: '6px 16px', fontSize: '0.8rem' }} onClick={() => setDrawMode(drawMode === 'hover' ? 'none' : 'hover')}>Hover</button>
              <button className={drawMode === 'click' ? "btn-primary" : "btn-secondary"} style={{ padding: '6px 16px', fontSize: '0.8rem' }} onClick={() => setDrawMode(drawMode === 'click' ? 'none' : 'click')}>Click & Drag</button>
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>Brush:</span>
              <select className="input" style={{ padding: '6px 12px', fontSize: '0.8rem' }} value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))}>
                <option value="1">Small</option>
                <option value="3">Medium</option>
                <option value="5">Large</option>
              </select>
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className={activeTool === 'fill' ? "btn-primary" : "btn-secondary"} style={{ padding: '6px 16px', fontSize: '0.8rem', background: activeTool === 'fill' ? '#818CF8' : 'var(--glass-bg)', color: activeTool === 'fill' ? 'white' : 'var(--color-text)' }} onClick={() => setActiveTool(activeTool === 'fill' ? 'brush' : 'fill')} title="Fill Bucket">
                Fill
              </button>
              <button className={activeTool === 'eraser' ? "btn-primary" : "btn-secondary"} style={{ padding: '6px 16px', fontSize: '0.8rem', background: activeTool === 'eraser' ? '#F472B6' : 'var(--glass-bg)', color: activeTool === 'eraser' ? 'white' : 'var(--color-text)' }} onClick={() => setActiveTool(activeTool === 'eraser' ? 'brush' : 'eraser')} title="Eraser Toggle">
                <Eraser size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Eraser
              </button>
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <button className={canOverwrite ? "btn-primary" : "btn-secondary"} style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setCanOverwrite(!canOverwrite)} title="Toggle Overwriting existing colors">
                Overwrite: {canOverwrite ? 'ON' : 'OFF'}
              </button>
              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleSnapshot} title="Download Image">
                <Camera size={14} />
              </button>
              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleUndo} title="Undo (Ctrl+Z)">
                Undo
              </button>
              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleRedo} title="Redo (Ctrl+Y)">
                Redo
              </button>
           </div>
        </div>
      )}

      <div style={{ width: '100%', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div 
          className={`hoverboard-container touch-drawing ${canvasType === 'plain' ? 'canvas-plain' : ''}`} 
          ref={containerRef}
          onDragStart={(e) => e.preventDefault()}
          style={{ 
            cursor: isArtist && isPlaying ? (activeTool === 'eraser' ? 'cell' : 'crosshair') : 'default',
            transform: activeMutator === 'upside_down' ? 'rotate(180deg)' : 'none',
            opacity: isBlindfolded ? 0 : 1,
            transition: 'opacity 1s, transform 0.5s'
          }}
        />
      </div>
    </div>
  );
}

export default App;
