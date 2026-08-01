// Simple Web Audio API Synthesizer for Hover-Guess
let audioCtx = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const playTone = (freq, type, duration, vol = 0.1) => {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
};

export const playSFX = (effect) => {
  initAudio();
  
  switch (effect) {
    case 'round_start':
      // Ascending chime
      playTone(440, 'sine', 0.1, 0.1);
      setTimeout(() => playTone(554.37, 'sine', 0.1, 0.1), 100);
      setTimeout(() => playTone(659.25, 'sine', 0.3, 0.1), 200);
      break;
    case 'guess':
      // Happy ding-ding
      playTone(880, 'triangle', 0.1, 0.1);
      setTimeout(() => playTone(1108.73, 'triangle', 0.3, 0.1), 150);
      break;
    case 'tick':
      // Low subtle tick
      playTone(200, 'square', 0.05, 0.05);
      break;
    case 'chat':
      // Soft pop
      playTone(600, 'sine', 0.05, 0.02);
      break;
    default:
      break;
  }
};
