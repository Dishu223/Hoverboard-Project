const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Serve static frontend files if they exist (for production/online play)
const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // We'll restrict this later if needed
    methods: ['GET', 'POST']
  }
});

// State management
const rooms = new Map(); // roomId -> { state: 'WAITING', players: [], currentArtistIndex: -1, currentWord: '', timer: 0, settings: {} }
const users = new Map(); // socketId -> { username, roomId, score }

const WORD_CATEGORIES = {
  fruits: ['apple', 'banana', 'orange', 'grape', 'mango', 'strawberry', 'watermelon', 'cherry'],
  animals: ['dog', 'cat', 'elephant', 'tiger', 'lion', 'giraffe', 'penguin', 'dolphin', 'bear'],
  places: ['hospital', 'school', 'park', 'beach', 'mountain', 'restaurant', 'airport', 'library'],
  mixed: ['apple', 'house', 'car', 'dog', 'cat', 'sun', 'tree', 'moon', 'star', 'book', 'pizza', 'phone']
};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('create_room', ({ username, settings }, callback) => {
    const roomId = generateRoomCode();
    
    const defaultSettings = {
      maxPlayers: 10,
      category: 'mixed',
      timeLimit: 60,
      customWords: '',
      maxRounds: 6,
      mutators: {
        enabled: false,
        symmetry: false,
        blindfold: false,
        upsideDown: false
      }
    };

    rooms.set(roomId, {
      id: roomId,
      players: [],
      state: 'WAITING', // WAITING, DRAWING
      settings: { ...defaultSettings, ...settings },
      currentArtistIndex: -1,
      currentWord: '',
      currentRound: 0,
      timer: null,
      timeRemaining: 0,
      guessedPlayers: new Set()
    });

    joinRoomLogic(socket, username, roomId, callback, settings?.avatar, settings?.isSpectator);
  });

  socket.on('join_room', ({ username, roomId, avatar, isSpectator }, callback) => {
    if (!roomId) {
      return callback({ error: 'Please enter a room code.' });
    }
    
    const roomCode = roomId.toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) {
      return callback({ error: 'Room not found' });
    }

    if (room.players.length >= room.settings.maxPlayers) {
      return callback({ error: 'Room is full' });
    }

    joinRoomLogic(socket, username, roomCode, callback, avatar, isSpectator);
  });

  function joinRoomLogic(socket, username, roomCode, callback, avatar, isSpectator) {
    const room = rooms.get(roomCode);
    const player = { 
      id: socket.id, 
      username, 
      score: 0, 
      isArtist: false,
      avatar: avatar || Array(64).fill('#ffffff'),
      isSpectator: !!isSpectator,
      votes: new Set()
    };
    room.players.push(player);
    users.set(socket.id, { username, roomId: roomCode, score: 0 });

    socket.join(roomCode);
    
    io.to(roomCode).emit('room_update', {
      players: room.players,
      state: room.state,
      settings: room.settings
    });
    
    callback({ success: true, roomId: roomCode });
  }

  socket.on('start_game', () => {
    const user = users.get(socket.id);
    if (user) {
      const room = rooms.get(user.roomId);
      if (room && room.state === 'WAITING' && room.players.length >= 1) {
        startRound(user.roomId);
      }
    }
  });

  socket.on('draw_batch', (drawData) => {
    const user = users.get(socket.id);
    if (user) {
      const room = rooms.get(user.roomId);
      if (room && room.state === 'DRAWING') {
         const artist = room.players[room.currentArtistIndex];
         if (artist && artist.id === socket.id) {
           socket.to(user.roomId).emit('draw_batch', drawData);
         }
      }
    }
  });

  socket.on('board_state', (boardState) => {
    const user = users.get(socket.id);
    if (user) {
      const room = rooms.get(user.roomId);
      if (room && room.state === 'DRAWING') {
         const artist = room.players[room.currentArtistIndex];
         if (artist && artist.id === socket.id) {
           socket.to(user.roomId).emit('board_state', boardState);
         }
      }
    }
  });

  socket.on('clear_board', () => {
    const user = users.get(socket.id);
    if (user) {
      const room = rooms.get(user.roomId);
      if (room && room.state === 'DRAWING') {
         const artist = room.players[room.currentArtistIndex];
         if (artist && artist.id === socket.id) {
           io.to(user.roomId).emit('clear_board');
         }
      }
    }
  });

  // Levenshtein Distance for 'Close Guess'
  const getLevenshteinDistance = (a, b) => {
    if(a.length === 0) return b.length; 
    if(b.length === 0) return a.length; 
    const matrix = [];
    for(let i = 0; i <= b.length; i++){ matrix[i] = [i]; }
    for(let j = 0; j <= a.length; j++){ matrix[0][j] = j; }
    for(let i = 1; i <= b.length; i++){
      for(let j = 1; j <= a.length; j++){
        if(b.charAt(i-1) == a.charAt(j-1)){
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1));
        }
      }
    }
    return matrix[b.length][a.length];
  };

  socket.on('send_message', (message) => {
    const user = users.get(socket.id);
    if (user) {
      const room = rooms.get(user.roomId);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        const avatar = player ? player.avatar : null;
        
        if (room.state === 'DRAWING') {
          if (!player.isArtist && !room.guessedPlayers.has(socket.id)) {
            const guess = message.toLowerCase().trim();
            const target = room.currentWord.toLowerCase();
            
            if (guess === target) {
              room.guessedPlayers.add(socket.id);
              
              // Dynamic Scoring based on time
              const maxPoints = 500;
              const timeRatio = room.timeRemaining / room.settings.timeLimit;
              const guessPoints = Math.floor(maxPoints * timeRatio) + 50; // Base 50 points
              
              player.score += guessPoints;
              
              // Artist gets points too
              const artist = room.players[room.currentArtistIndex];
              if (artist) {
                const artistPoints = Math.floor(maxPoints / (room.players.length - 1 || 1));
                artist.score += artistPoints;
              }

              io.to(user.roomId).emit('chat_message', { system: true, text: `🎉 ${user.username} guessed the word! (+${guessPoints} pts)` });
              io.to(user.roomId).emit('room_update', { players: room.players, state: room.state, settings: room.settings });
              
              // If everyone guessed it
              if (room.guessedPlayers.size === room.players.length - 1) {
                endRound(user.roomId);
              }
              return;
            } else if (target.length > 3 && getLevenshteinDistance(guess, target) <= 2) {
              // Close Guess
              socket.emit('chat_message', { system: true, text: `'${message}' is very close!` });
              // Still broadcast the message so others see it, but don't count it as right
            }
          }
        }
        
        // Artists and users who already guessed can still chat, but maybe shouldn't spoil it
        // However, we just send standard chat.
        io.to(user.roomId).emit('chat_message', { username: user.username, text: message, avatar });
      }
    }
  });

  socket.on('reaction', (emoji) => {
    const user = users.get(socket.id);
    if (user) {
      io.to(user.roomId).emit('room_reaction', emoji);
    }
  });

  socket.on('votekick', (targetId) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const room = rooms.get(user.roomId);
    if (!room) return;
    
    const targetPlayer = room.players.find(p => p.id === targetId);
    if (!targetPlayer) return;

    // Track the vote
    targetPlayer.votes = targetPlayer.votes || new Set();
    targetPlayer.votes.add(socket.id);

    // If votes > 50% of room players (excluding the target), they are kicked
    const requiredVotes = Math.ceil((room.players.length - 1) / 2);
    if (targetPlayer.votes.size >= requiredVotes) {
      // Kick them
      io.to(targetId).emit('kicked');
      // They will disconnect themselves or we can just force remove them
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) {
        targetSocket.disconnect();
      }
      
      io.to(user.roomId).emit('chat_message', { system: true, text: `${targetPlayer.username} was kicked from the room by vote.` });
    } else {
      io.to(user.roomId).emit('chat_message', { system: true, text: `Vote to kick ${targetPlayer.username} (${targetPlayer.votes.size}/${requiredVotes})` });
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const room = rooms.get(user.roomId);
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        if (room.players.length === 0) {
          rooms.delete(user.roomId);
        } else {
          io.to(user.roomId).emit('room_update', { players: room.players, state: room.state, settings: room.settings });
          if (room.state !== 'WAITING') {
            const artist = room.players[room.currentArtistIndex];
            if (!artist || artist.id === socket.id) {
              endRound(user.roomId);
            }
          }
        }
      }
      users.delete(socket.id);
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

function startRound(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }

  room.players.forEach(p => p.isArtist = false);

  let attempts = 0;
  do {
    room.currentArtistIndex = (room.currentArtistIndex + 1) % room.players.length;
    attempts++;
  } while (room.players[room.currentArtistIndex].isSpectator && attempts < room.players.length);

  room.players[room.currentArtistIndex].isArtist = true;
  room.guessedPlayers.clear();
  
  // Transition to ROUND_STARTING phase
  room.state = 'ROUND_STARTING';
  room.currentRound += 1;
  room.timeRemaining = 5; // 5-second countdown
  
  // Explicitly clear board for everyone
  io.to(roomId).emit('clear_board');
  io.to(roomId).emit('room_update', { players: room.players, state: room.state, settings: room.settings, currentRound: room.currentRound });
  
  room.timer = setInterval(() => {
    room.timeRemaining--;
    io.to(roomId).emit('timer_update', room.timeRemaining);
    
    if (room.timeRemaining <= 0) {
      clearInterval(room.timer);
      room.timer = null;
      beginDrawingPhase(roomId);
    }
  }, 1000);
}

function beginDrawingPhase(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  let categoryWords = WORD_CATEGORIES[room.settings.category] || WORD_CATEGORIES.mixed;
  
  if (room.settings.category === 'custom' && room.settings.customWords && room.settings.customWords.trim().length > 0) {
    const customList = room.settings.customWords.split(',').map(w => w.trim()).filter(w => w.length > 0);
    if (customList.length > 0) {
      categoryWords = customList;
    }
  }

  const word = categoryWords[Math.floor(Math.random() * categoryWords.length)];
  room.currentWord = word;
  room.state = 'DRAWING';
  room.timeRemaining = room.settings.timeLimit;
  
  const hint = room.currentWord.replace(/[a-zA-Z]/g, '_ ').trim();
  
  const artist = room.players[room.currentArtistIndex];
  if (artist) {
    io.to(roomId).emit('chat_message', { system: true, text: `Round ${room.currentRound} started! ${artist.username} is drawing.` });
  }

  // Select Mutator
  room.activeMutator = 'none';
  if (room.settings.mutators && room.settings.mutators.enabled) {
    const available = [];
    if (room.settings.mutators.symmetry) available.push('symmetry');
    if (room.settings.mutators.blindfold) available.push('blindfold');
    if (room.settings.mutators.upsideDown) available.push('upside_down');
    
    if (available.length > 0 && Math.random() > 0.3) {
      room.activeMutator = available[Math.floor(Math.random() * available.length)];
    }
  }
  
  io.to(roomId).emit('room_update', { players: room.players, state: room.state, settings: room.settings, currentRound: room.currentRound });
  io.to(roomId).emit('round_start', { 
    artistId: room.players[room.currentArtistIndex].id,
    artistName: room.players[room.currentArtistIndex].username,
    activeMutator: room.activeMutator
  });
  
  io.to(roomId).emit('timer_update', room.timeRemaining);
  
  // Pre-calculate hint string
  const hintArray = room.currentWord.split('').map(c => c === ' ' ? ' ' : '_');
  const revealCount = Math.max(1, Math.floor(room.currentWord.length * 0.3));
  for(let i=0; i<revealCount; i++) {
     let rIdx = Math.floor(Math.random() * room.currentWord.length);
     while(hintArray[rIdx] !== '_' && room.currentWord[rIdx] !== ' ') {
        rIdx = (rIdx + 1) % room.currentWord.length;
     }
     hintArray[rIdx] = room.currentWord[rIdx].toUpperCase();
  }
  const hintString = hintArray.join(' ');
  
  io.to(roomId).emit('word_hint', room.currentWord.replace(/[a-zA-Z]/g, '_ ').trim());

  // Send the actual word only to the artist
  if (artist) {
    io.to(artist.id).emit('your_word', room.currentWord);
  }

  const halfTime = Math.floor(room.settings.timeLimit / 2);

  room.timer = setInterval(() => {
    room.timeRemaining--;
    io.to(roomId).emit('timer_update', room.timeRemaining);
    
    if (room.timeRemaining === halfTime) {
       io.to(roomId).emit('word_hint', hintString);
    }
    
    if (room.timeRemaining <= 0) {
      clearInterval(room.timer);
      room.timer = null;
      endRound(roomId);
    }
  }, 1000);
}

function endRound(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }

  io.to(roomId).emit('round_end', { word: room.currentWord });
  io.to(roomId).emit('chat_message', { system: true, text: `Round ended! The word was: ${room.currentWord}` });
  
  if (room.currentRound >= room.settings.maxRounds) {
    room.state = 'GAME_OVER';
    io.to(roomId).emit('room_update', { players: room.players, state: room.state, settings: room.settings, currentRound: room.currentRound });
  } else {
    // Wait 5 seconds before starting the next round automatically, or just start it
    // because startRound() has a 5-second ROUND_STARTING phase anyway!
    startRound(roomId);
  }
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
