import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Camera } from 'lucide-react';
import { toPng } from 'html-to-image';

export function CanvasBoard({ socket, isArtist, isPlaying, activeMutator }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [selectedColor, setSelectedColor] = useState('random');
  const [customColor, setCustomColor] = useState('#000000');
  const [activeTool, setActiveTool] = useState('brush'); // brush, eraser, fill
  const [brushSize, setBrushSize] = useState(3);
  const [isBlindfolded, setIsBlindfolded] = useState(false);

  const isMouseDownRef = useRef(false);
  const lastPosRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const strokeBufferRef = useRef([]);

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

  const optsRef = useRef({ selectedColor, activeTool, brushSize, customColor, activeMutator });

  useEffect(() => {
    optsRef.current = { selectedColor, activeTool, brushSize, customColor, activeMutator };
  }, [selectedColor, activeTool, brushSize, customColor, activeMutator]);

  useEffect(() => {
    if (activeMutator === 'blindfold' && isPlaying && isArtist) {
      const timer = setTimeout(() => setIsBlindfolded(true), 5000);
      return () => clearTimeout(timer);
    } else {
      setIsBlindfolded(false);
    }
  }, [activeMutator, isPlaying, isArtist]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Set initial background
    if (!undoStackRef.current.length) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      undoStackRef.current.push(canvas.toDataURL());
    }

    const saveState = () => {
      undoStackRef.current.push(canvas.toDataURL());
      if (undoStackRef.current.length > 30) undoStackRef.current.shift();
      redoStackRef.current = [];
    };

    const getMousePos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    };

    const emitDraw = (type, data) => {
      if (socket && isArtist && isPlaying) {
        if (type === 'stroke') {
          // Tuple pack: [typeId, x0, y0, x1, y1, color, size, isEraser]
          strokeBufferRef.current.push([
            1, 
            Math.round(data.x0), Math.round(data.y0), 
            Math.round(data.x1), Math.round(data.y1), 
            data.color, data.size, data.isEraser ? 1 : 0
          ]);
        } else if (type === 'fill') {
          strokeBufferRef.current.push([2, data.color]);
        } else if (type === 'clear') {
          strokeBufferRef.current.push([3]);
        }
      }
    };

    const applyDrawEvent = (data) => {
      const tCtx = canvasRef.current.getContext('2d');
      
      if (data.tuples) {
        // Unpack batched tuples
        data.tuples.forEach(tuple => {
          const typeId = tuple[0];
          if (typeId === 1) { // stroke
            tCtx.beginPath();
            tCtx.moveTo(tuple[1], tuple[2]);
            tCtx.lineTo(tuple[3], tuple[4]);
            tCtx.strokeStyle = tuple[7] ? '#ffffff' : tuple[5];
            tCtx.lineWidth = tuple[6] * 3;
            tCtx.lineCap = 'round';
            tCtx.lineJoin = 'round';
            tCtx.stroke();
          } else if (typeId === 2) { // fill
            tCtx.fillStyle = tuple[1];
            tCtx.fillRect(0, 0, canvas.width, canvas.height);
          } else if (typeId === 3) { // clear
            tCtx.fillStyle = '#ffffff';
            tCtx.fillRect(0, 0, canvas.width, canvas.height);
          }
        });
      } else {
        // Fallback for old unbatched events (if any arrive during transition)
        const { type } = data;
        if (type === 'stroke') {
          const { x0, y0, x1, y1, color, size, isEraser } = data;
          tCtx.beginPath();
          tCtx.moveTo(x0, y0);
          tCtx.lineTo(x1, y1);
          tCtx.strokeStyle = isEraser ? '#ffffff' : color;
          tCtx.lineWidth = size * 3;
          tCtx.lineCap = 'round';
          tCtx.lineJoin = 'round';
          tCtx.stroke();
        } else if (type === 'fill') {
          tCtx.fillStyle = data.color;
          tCtx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (type === 'clear') {
          tCtx.fillStyle = '#ffffff';
          tCtx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    };

    const handleStart = (e) => {
      if (!isArtist || !isPlaying) return;
      e.preventDefault();
      saveState();
      
      const { activeTool, selectedColor, customColor } = optsRef.current;
      if (activeTool === 'fill') {
        let color = selectedColor === 'random' 
          ? colors[Math.floor(Math.random() * (colors.length - 2))].hex 
          : (selectedColor === 'custom' ? customColor : selectedColor);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        emitDraw('fill', { color });
        if (socket) socket.emit('board_state', canvas.toDataURL());
        return;
      }
      
      isMouseDownRef.current = true;
      lastPosRef.current = getMousePos(e);
      // Draw a dot for simple clicks
      handleMove(e, true);
    };

    const handleMove = (e, isDot = false) => {
      if (!isMouseDownRef.current || !isArtist || !isPlaying) return;
      e.preventDefault();
      const pos = getMousePos(e);
      const { selectedColor, customColor, activeTool, brushSize, activeMutator } = optsRef.current;
      
      if (activeTool === 'fill') return;
      
      const isEraser = activeTool === 'eraser';
      let color = selectedColor === 'random' 
          ? colors[Math.floor(Math.random() * (colors.length - 2))].hex 
          : (selectedColor === 'custom' ? customColor : selectedColor);

      const drawStroke = (x0, y0, x1, y1) => {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = isEraser ? '#ffffff' : color;
        ctx.lineWidth = brushSize * 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        emitDraw('stroke', { x0, y0, x1, y1, color, size: brushSize, isEraser });
      };

      if (isDot) {
         drawStroke(pos.x, pos.y, pos.x + 0.1, pos.y + 0.1);
      } else {
         drawStroke(lastPosRef.current.x, lastPosRef.current.y, pos.x, pos.y);
      }

      if (activeMutator === 'symmetry') {
        const cx = canvas.width / 2;
        const symX0 = cx + (cx - (isDot ? pos.x : lastPosRef.current.x));
        const symX1 = cx + (cx - pos.x);
        drawStroke(symX0, (isDot ? pos.y : lastPosRef.current.y), symX1, pos.y);
      }

      lastPosRef.current = pos;
    };

    const handleEnd = () => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;
        if (socket && isArtist && isPlaying) {
          socket.emit('board_state', canvas.toDataURL());
        }
      }
    };

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', (e) => handleMove(e));
    window.addEventListener('mouseup', handleEnd);
    
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', (e) => handleMove(e), { passive: false });
    window.addEventListener('touchend', handleEnd);

    const onDrawBatch = (data) => {
      if (!data.isCanvas) return; // ignore pixel board events
      applyDrawEvent(data);
    };

    const onBoardState = (data) => {
      if (typeof data === 'string' && data.startsWith('data:image')) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = data;
      }
    };

    const onClear = () => {
      applyDrawEvent({ type: 'clear' });
    };

    if (socket) {
      socket.on('draw_batch', onDrawBatch);
      socket.on('board_state', onBoardState);
      socket.on('clear_board', onClear);
      socket.on('request_board_state', () => {
        if (isArtistRef.current && isPlayingRef.current && canvasRef.current) {
          socket.emit('board_state', canvasRef.current.toDataURL());
        }
      });
    }

    // Flush batch loop
    const flushInterval = setInterval(() => {
      if (strokeBufferRef.current.length > 0 && socket && isArtist && isPlaying) {
        socket.emit('draw_batch', { tuples: strokeBufferRef.current, isCanvas: true });
        strokeBufferRef.current = []; // Clear buffer
      }
    }, 50);

    return () => {
      clearInterval(flushInterval);
      canvas.removeEventListener('mousedown', handleStart);
      canvas.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      canvas.removeEventListener('touchstart', handleStart);
      canvas.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);

      if (socket) {
        socket.off('draw_batch', onDrawBatch);
        socket.off('board_state', onBoardState);
        socket.off('clear_board', onClear);
        socket.off('request_board_state');
      }
    };
  }, [socket, isArtist, isPlaying]);

  const handleUndo = () => {
    if (undoStackRef.current.length > 1) {
      const currentState = undoStackRef.current.pop();
      redoStackRef.current.push(currentState);
      const previousState = undoStackRef.current[undoStackRef.current.length - 1];
      
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0);
        if (socket) socket.emit('board_state', previousState);
      };
      img.src = previousState;
    }
  };

  const handleRedo = () => {
    if (redoStackRef.current.length > 0) {
      const nextState = redoStackRef.current.pop();
      undoStackRef.current.push(nextState);
      
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0);
        if (socket) socket.emit('board_state', nextState);
      };
      img.src = nextState;
    }
  };

  const handleClear = () => {
    if (!isArtist || !isPlaying) return;
    undoStackRef.current.push(canvasRef.current.toDataURL());
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (socket) {
      socket.emit('clear_board');
      socket.emit('board_state', canvasRef.current.toDataURL());
    }
  };

  const handleSnapshot = () => {
    if (containerRef.current) {
      toPng(containerRef.current, { backgroundColor: '#ffffff' })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = 'lumynati-masterpiece.png';
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => console.error('Snapshot failed', err));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isArtist || !isPlaying) return;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
      {isArtist && isPlaying && (
         <div style={{ padding: '12px 24px', background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', borderRadius: '24px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '20px', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxWidth: '320px', justifyContent: 'center', borderRight: '1px solid var(--glass-border)', paddingRight: '20px' }}>
              {colors.map(c => (
                <button 
                  key={c.name}
                  className={`color-btn ${selectedColor === c.hex ? 'selected' : ''}`}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => setSelectedColor(c.hex)}
                  title={c.name}
                />
              ))}
              <button 
                  className={`color-btn ${selectedColor === 'random' ? 'selected' : ''}`}
                  style={{ background: 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)' }}
                  onClick={() => setSelectedColor('random')}
                  title="Rainbow"
              />
              <input 
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    setSelectedColor('custom');
                  }} 
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', width: '32px', height: '32px', padding: 0 }} 
                  title="Choose Custom Color"
              />
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>Brush:</span>
              <select className="input" style={{ padding: '6px 12px', fontSize: '0.8rem' }} value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))}>
                <option value="1">Small</option>
                <option value="3">Medium</option>
                <option value="5">Large</option>
                <option value="10">Huge</option>
              </select>
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className={activeTool === 'fill' ? "btn-primary" : "btn-secondary"} style={{ padding: '6px 16px', fontSize: '0.8rem', background: activeTool === 'fill' ? '#818CF8' : 'var(--glass-bg)', color: activeTool === 'fill' ? 'white' : 'var(--color-text)' }} onClick={() => setActiveTool(activeTool === 'fill' ? 'brush' : 'fill')} title="Fill Background">
                Fill
              </button>
              <button className={activeTool === 'eraser' ? "btn-primary" : "btn-secondary"} style={{ padding: '6px 16px', fontSize: '0.8rem', background: activeTool === 'eraser' ? '#F472B6' : 'var(--glass-bg)', color: activeTool === 'eraser' ? 'white' : 'var(--color-text)' }} onClick={() => setActiveTool(activeTool === 'eraser' ? 'brush' : 'eraser')} title="Eraser Toggle">
                <Eraser size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Eraser
              </button>
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#F472B6', borderColor: '#F472B6' }} onClick={handleClear} title="Clear Canvas">
                Clear
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

      <div style={{ width: '100%', height: '100%', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0, minHeight: 0 }}>
        <div 
          ref={containerRef}
          style={{ 
            transform: activeMutator === 'upside_down' ? 'rotate(180deg)' : 'none',
            opacity: isBlindfolded ? 0 : 1,
            transition: 'opacity 1s, transform 0.5s',
            border: '4px solid var(--color-primary)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px var(--shadow-color)',
            background: 'white',
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: '4 / 3',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              cursor: isArtist && isPlaying ? (activeTool === 'eraser' ? 'cell' : 'crosshair') : 'default',
              touchAction: 'none'
            }}
          />
        </div>
      </div>
    </div>
  );
}
