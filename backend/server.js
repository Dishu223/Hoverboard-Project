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
  animals: ['dog', 'cat', 'elephant', 'tiger', 'lion', 'giraffe', 'penguin', 'dolphin', 'bear', 'monkey', 'snake', 'rabbit', 'turtle', 'shark', 'whale', 'spider', 'frog', 'bird', 'owl', 'bat', 'horse', 'cow', 'pig', 'sheep', 'goat', 'duck', 'chicken', 'mouse', 'kangaroo', 'zebra'],
  places: ['hospital', 'school', 'park', 'beach', 'mountain', 'restaurant', 'airport', 'library', 'bank', 'church', 'castle', 'farm', 'island', 'forest', 'desert', 'cave', 'city', 'village', 'bridge', 'factory', 'zoo', 'museum', 'hotel', 'cinema', 'stadium', 'pool', 'gym', 'office', 'house', 'tent'],
  food: ['apple', 'banana', 'orange', 'grape', 'mango', 'strawberry', 'watermelon', 'cherry', 'pizza', 'burger', 'hotdog', 'taco', 'sushi', 'cheese', 'bread', 'cake', 'cookie', 'ice cream', 'donut', 'chocolate', 'egg', 'bacon', 'pancake', 'waffle', 'fries', 'popcorn', 'carrot', 'broccoli', 'corn', 'potato'],
  objects: ['clock', 'chair', 'table', 'bed', 'sofa', 'lamp', 'television', 'computer', 'phone', 'camera', 'book', 'pen', 'pencil', 'scissors', 'knife', 'fork', 'spoon', 'plate', 'cup', 'bottle', 'box', 'key', 'door', 'window', 'mirror', 'comb', 'toothbrush', 'soap', 'towel', 'basket'],
  nature: ['sun', 'moon', 'star', 'cloud', 'rain', 'snow', 'lightning', 'tree', 'flower', 'grass', 'leaf', 'rock', 'river', 'lake', 'ocean', 'wave', 'fire', 'smoke', 'wind', 'tornado', 'volcano', 'earth', 'planet', 'rainbow', 'meteor', 'sand', 'dirt', 'mud', 'puddle', 'ice'],
  body: ['head', 'eye', 'ear', 'nose', 'mouth', 'tooth', 'tongue', 'hair', 'neck', 'shoulder', 'arm', 'elbow', 'hand', 'finger', 'thumb', 'chest', 'back', 'stomach', 'leg', 'knee', 'foot', 'toe', 'heel', 'ankle', 'bone', 'heart', 'brain', 'blood', 'skin', 'muscle'],
  clothing: ['shirt', 't-shirt', 'pants', 'jeans', 'shorts', 'skirt', 'dress', 'jacket', 'coat', 'sweater', 'hoodie', 'suit', 'tie', 'sock', 'shoe', 'boot', 'sneaker', 'sandal', 'hat', 'cap', 'beanie', 'scarf', 'glove', 'mitten', 'belt', 'glasses', 'sunglasses', 'watch', 'ring', 'necklace'],
  vehicles: ['car', 'truck', 'bus', 'van', 'taxi', 'police car', 'ambulance', 'fire engine', 'motorcycle', 'bicycle', 'scooter', 'skateboard', 'roller skates', 'train', 'subway', 'tram', 'airplane', 'helicopter', 'rocket', 'spaceship', 'boat', 'ship', 'submarine', 'canoe', 'kayak', 'tractor', 'tank', 'bulldozer', 'crane', 'forklift'],
  sports: ['soccer', 'basketball', 'baseball', 'tennis', 'volleyball', 'golf', 'football', 'rugby', 'cricket', 'hockey', 'boxing', 'wrestling', 'karate', 'judo', 'swimming', 'diving', 'surfing', 'skiing', 'snowboarding', 'skating', 'cycling', 'running', 'jumping', 'gymnastics', 'weightlifting', 'Archery', 'fencing', 'bowling', 'billiards', 'darts'],
  actions: ['run', 'walk', 'jump', 'skip', 'hop', 'crawl', 'climb', 'swim', 'dive', 'fly', 'dance', 'sing', 'shout', 'whisper', 'cry', 'laugh', 'smile', 'frown', 'sleep', 'wake', 'eat', 'drink', 'cook', 'bake', 'read', 'write', 'draw', 'paint', 'play', 'work']
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
      categories: ['animals', 'food', 'objects'],
      canvasType: 'hoverboard',
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
      guessedPlayers: new Set(),
      usedWords: new Set()
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
    
    // Clear room deletion timeout if it exists
    if (room.deleteTimeout) {
      clearTimeout(room.deleteTimeout);
      room.deleteTimeout = null;
    }

    let player = room.players.find(p => p.username === username);
    
    if (player) {
      // Reconnection!
      if (player.disconnectTimeoutId) {
        clearTimeout(player.disconnectTimeoutId);
        player.disconnectTimeoutId = null;
      }
      
      // Remove old socket from users map
      users.delete(player.id);
      
      // Update with new socket
      player.id = socket.id;
      users.set(socket.id, { username, roomId: roomCode, score: player.score });
      socket.join(roomCode);
      
      io.to(roomCode).emit('room_update', {
        players: room.players,
        state: room.state,
        settings: room.settings
      });
      // Send the current word hint to the rejoining player if in DRAWING state
      if (room.state === 'DRAWING') {
        const hint = room.currentWord.replace(/[a-zA-Z]/g, '_ ').trim();
        const artist = room.players[room.currentArtistIndex];
        const isArtist = artist && artist.username === username;
        
        if (isArtist) {
          socket.emit('word_to_draw', room.currentWord);
        } else {
          socket.emit('word_hint', hint);
          
          // Request current board state from the artist for this rejoining player
          if (room.currentArtistIndex !== -1) {
            const currentArtist = room.players[room.currentArtistIndex];
            if (currentArtist && currentArtist.id !== socket.id) {
              io.to(currentArtist.id).emit('request_board_state');
            }
          }
        }
      }
      return callback({ success: true, roomId: roomCode });
    }

    // New Player
    player = { 
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
    
    // If the room is already in DRAWING state, send the hint and request board state
    if (room.state === 'DRAWING') {
      const hint = room.currentWord.replace(/[a-zA-Z]/g, '_ ').trim();
      socket.emit('word_hint', hint);
      
      if (room.currentArtistIndex !== -1) {
        const currentArtist = room.players[room.currentArtistIndex];
        if (currentArtist && currentArtist.id !== socket.id) {
          io.to(currentArtist.id).emit('request_board_state');
        }
      }
    }
    
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
            const rawGuess = message.toLowerCase().trim();
            const rawTarget = room.currentWord.toLowerCase();
            const guess = rawGuess.replace(/[^a-z0-9]/g, '');
            const target = rawTarget.replace(/[^a-z0-9]/g, '');
            
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

              io.to(user.roomId).emit('chat_message', { system: true, text: `🎉 ${user.username} guessed the word! (+${guessPoints} pts)`, type: 'correct_guess' });
              io.to(user.roomId).emit('room_update', { players: room.players, state: room.state, settings: room.settings });
              
              // If everyone guessed it
              if (room.guessedPlayers.size === room.players.length - 1) {
                endRound(user.roomId);
              }
              return;
            } else if (target.length > 3 && getLevenshteinDistance(guess, target) <= 2) {
              // Close Guess
              socket.emit('chat_message', { system: true, text: `'${message}' is very close!`, type: 'close_guess' });
              // Still broadcast the message so others see it, but don't count it as right
            } else {
              // Wrong Guess
              if (room.settings.penaltyOnWrongGuess) {
                player.score = Math.max(0, player.score - 2);
                socket.emit('chat_message', { system: true, text: `❌ Incorrect! (-2 pts)`, type: 'wrong_guess' });
                io.to(user.roomId).emit('room_update', { players: room.players, state: room.state, settings: room.settings });
              }
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
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.disconnectTimeoutId = setTimeout(() => {
            const currentRoom = rooms.get(user.roomId);
            if (!currentRoom) return;
            
            const pIndex = currentRoom.players.findIndex(p => p.id === socket.id);
            if (pIndex !== -1) {
              const wasArtist = (currentRoom.state !== 'WAITING' && currentRoom.currentArtistIndex === pIndex);
              
              currentRoom.players.splice(pIndex, 1);
              if (currentRoom.currentArtistIndex >= currentRoom.players.length) {
                 currentRoom.currentArtistIndex = 0;
              }
              
              if (currentRoom.players.length === 0) {
                // Empty room cleanup in 10 minutes
                currentRoom.deleteTimeout = setTimeout(() => {
                  rooms.delete(user.roomId);
                }, 10 * 60 * 1000);
              } else {
                io.to(user.roomId).emit('room_update', { players: currentRoom.players, state: currentRoom.state, settings: currentRoom.settings });
                if (wasArtist) {
                  endRound(user.roomId);
                }
              }
            }
          }, 60000); // 60 seconds grace period
        }
      }
      users.delete(socket.id);
    }
    console.log(`User disconnected: ${socket.id}`);
  });

  socket.on('leave_room', () => {
    handleDisconnect(socket);
  });

  // --- WORD SELECTION EVENTS ---
  socket.on('select_word', ({ word }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const room = rooms.get(user.roomId);
    if (!room || room.state !== 'WORD_SELECTION') return;
    
    const artist = room.players[room.currentArtistIndex];
    if (artist && artist.id === socket.id) {
      if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
      }
      beginDrawingPhase(user.roomId, word);
    }
  });

  socket.on('shuffle_words', () => {
    const user = users.get(socket.id);
    if (!user) return;
    const room = rooms.get(user.roomId);
    if (!room || room.state !== 'WORD_SELECTION') return;
    
    const artist = room.players[room.currentArtistIndex];
    if (artist && artist.id === socket.id) {
      if (room.shufflesRemaining > 0) {
        room.shufflesRemaining--;
        const words = getThreeRandomWords(room);
        room.currentSelectionWords = words;
        socket.emit('word_selection_start', { words, shufflesRemaining: room.shufflesRemaining });
      }
    }
  });
});

function getThreeRandomWords(room) {
  let categoryWords = [];
  if (room.settings.categories && Array.isArray(room.settings.categories)) {
    room.settings.categories.forEach(cat => {
      if (WORD_CATEGORIES[cat]) {
        categoryWords = categoryWords.concat(WORD_CATEGORIES[cat]);
      } else if (cat === 'custom' && room.settings.customWords) {
        const customList = room.settings.customWords.split(',').map(w => w.trim()).filter(w => w.length > 0);
        categoryWords = categoryWords.concat(customList);
      }
    });
  }
  
  if (categoryWords.length < 3) {
    categoryWords = WORD_CATEGORIES.animals.concat(WORD_CATEGORIES.food, WORD_CATEGORIES.objects);
  }

  if (room.settings.allowRepeatingWords === false) {
    let availableWords = categoryWords.filter(w => !room.usedWords.has(w));
    if (availableWords.length < 3) {
      // If we ran out of unique words, reset the used words and fallback
      room.usedWords.clear();
      availableWords = categoryWords;
    }
    const shuffled = [...availableWords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  }

  const shuffled = [...categoryWords].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
}

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
  
  // Transition to WORD_SELECTION phase
  room.state = 'WORD_SELECTION';
  room.currentRound += 1;
  room.timeRemaining = room.settings.wordSelectionTime || 15; // Variable selection phase
  room.shufflesRemaining = 3;
  
  // Explicitly clear board for everyone
  io.to(roomId).emit('clear_board');
  io.to(roomId).emit('room_update', { players: room.players, state: room.state, settings: room.settings, currentRound: room.currentRound });
  
  const artist = room.players[room.currentArtistIndex];
  
  if (room.settings.customDrawMode) {
    if (artist) {
      io.to(artist.id).emit('word_selection_start', { customDrawMode: true });
    }
  } else {
    // Get 3 words
    const words = getThreeRandomWords(room);
    room.currentSelectionWords = words;
    if (artist) {
      io.to(artist.id).emit('word_selection_start', { words, shufflesRemaining: room.shufflesRemaining, customDrawMode: false });
    }
  }

  room.timer = setInterval(() => {
    room.timeRemaining--;
    io.to(roomId).emit('timer_update', room.timeRemaining);
    
    if (room.timeRemaining <= 0) {
      clearInterval(room.timer);
      room.timer = null;
      if (room.settings.customDrawMode) {
        beginDrawingPhase(roomId, getThreeRandomWords(room)[0]);
      } else {
        const autoWord = room.currentSelectionWords[Math.floor(Math.random() * room.currentSelectionWords.length)];
        beginDrawingPhase(roomId, autoWord);
      }
    }
  }, 1000);
}

function beginDrawingPhase(roomId, selectedWord) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  if (selectedWord) {
    room.usedWords.add(selectedWord);
  }
  
  room.currentWord = selectedWord || 'mystery';
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

app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
