const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { getRandomWord, isValidWord, getDuplicateLetterInfo } = require('./words');

// Lightweight sanitizer (replaces heavy jsdom+dompurify to save ~100MB RAM)
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().substring(0, 50);
}

const app = express();
app.set('trust proxy', 1); // Trust first proxy for Serveo/Pinggy

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "wss://*", "https://*"],
    },
  },
}));
app.use(cors());

// Custom XSS Sanitizer Middleware (lightweight)
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitize(req.body[key]);
      }
    }
  }
  next();
};

app.use(express.json());
app.use(sanitizeBody);

// Rate Limiting (HTTP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per 15 mins
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

// ── Data Stores ──────────────────────────────────────────────
const rooms = {};      // roomCode -> roomData
const playerStats = {}; // socketId -> { name, wordsGuessed, gamesWon, gamesPlayed }
const MAX_PLAYERS = 1000;

function getTotalPlayers() {
  return Object.values(rooms).reduce((sum, r) => sum + Object.keys(r.players).length, 0);
}

function generateRoomCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms[code]);
  return code;
}

function compareWords(guess, target) {
  const result = [];
  const targetArr = target.toLowerCase().split('');
  const guessArr = guess.toLowerCase().split('');
  const used = new Array(targetArr.length).fill(false);

  // First pass: find exact matches (green)
  for (let i = 0; i < guessArr.length; i++) {
    if (guessArr[i] === targetArr[i]) {
      result[i] = 'green';
      used[i] = true;
    }
  }

  // Second pass: find wrong position matches (yellow) and misses (red)
  for (let i = 0; i < guessArr.length; i++) {
    if (result[i]) continue;
    let found = false;
    for (let j = 0; j < targetArr.length; j++) {
      if (!used[j] && guessArr[i] === targetArr[j]) {
        result[i] = 'yellow';
        used[j] = true;
        found = true;
        break;
      }
    }
    if (!found) result[i] = 'red';
  }

  return result;
}

function startNewRound(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  room.round++;
  room.currentWord = getRandomWord(room.wordLength, room.difficulty);
  room.roundStartTime = Date.now();
  room.roundWinner = null;

  // Clear guesses for all players
  for (const pid of Object.keys(room.players)) {
    room.players[pid].guesses = [];
    room.players[pid].guessedCorrectly = false;
  }

  // Get duplicate letter info
  const dupes = getDuplicateLetterInfo(room.currentWord);
  let dupeMessage = null;
  if (dupes.length > 0) {
    dupeMessage = dupes.map(d =>
      `${d.countWord} same alphabets "${d.letter}" are used in this word`
    ).join(', ');
  }

  // Clear previous timer
  if (room.timer) clearInterval(room.timer);

  // Send round start to all players
  io.to(roomCode).emit('roundStart', {
    round: room.round,
    wordLength: room.wordLength,
    dupeMessage,
    timeLimit: 90
  });



  // Start 90 second timer
  room.timeLeft = 90;
  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(roomCode).emit('timerUpdate', room.timeLeft);
    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      // Time's up - reveal word, start next round
      io.to(roomCode).emit('roundEnd', {
        word: room.currentWord,
        winner: null,
        message: `Time's up! The word was "${room.currentWord.toUpperCase()}"`
      });
      // Update stats
      for (const pid of Object.keys(room.players)) {
        if (playerStats[pid]) playerStats[pid].gamesPlayed++;
      }
      setTimeout(() => startNewRound(roomCode), 4000);
    }
  }, 1000);
}

// ── Socket.IO Events ─────────────────────────────────────────

// Rate Limit track for sockets to prevent spam
const socketRateLimits = {};
const SOCKET_RATE_LIMIT = 5; // max 5 events per second
const SOCKET_RATE_WINDOW = 1000;

function checkSocketRateLimit(socketId) {
  const now = Date.now();
  if (!socketRateLimits[socketId]) {
    socketRateLimits[socketId] = { count: 1, lastReset: now };
    return true;
  }
  const tracker = socketRateLimits[socketId];
  if (now - tracker.lastReset > SOCKET_RATE_WINDOW) {
    tracker.count = 1;
    tracker.lastReset = now;
    return true;
  }
  tracker.count++;
  return tracker.count <= SOCKET_RATE_LIMIT;
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Initialize player stats
  playerStats[socket.id] = { name: 'Player', wordsGuessed: 0, gamesWon: 0, gamesPlayed: 0 };
  
  // Middleware for socket events to apply rate limiting
  socket.use(([event, ...args], next) => {
    if (!checkSocketRateLimit(socket.id)) {
      console.warn(`Rate limit exceeded for socket: ${socket.id}`);
      return next(new Error('Rate limit exceeded. Please slow down.'));
    }
    next();
  });

  socket.on('error', (err) => {
    socket.emit('error', { message: err.message });
  });

  socket.on('setName', (name) => {
    if (playerStats[socket.id]) {
      const cleanName = sanitize(name || 'Player');
      playerStats[socket.id].name = cleanName;
    }
  });

  socket.on('createRoom', ({ wordLength, difficulty, mode }, callback) => {
    // Scaling Protection: Limit total players
    if (getTotalPlayers() >= MAX_PLAYERS) {
      return callback?.({ success: false, message: 'Server is full (1000 players reached)! Please try again later.' });
    }

    const code = generateRoomCode();
    rooms[code] = {
      code,
      creator: socket.id,
      wordLength: parseInt(wordLength) || 5,
      difficulty: difficulty || 'easy',
      players: {
        [socket.id]: {
          name: playerStats[socket.id]?.name || 'Player',
          guesses: [],
          guessedCorrectly: false,
          score: 0
        }
      },
      currentWord: null,
      round: 0,
      roundWinner: null,
      roundStartTime: null,
      timer: null,
      started: false,
      maxPlayers: 4,
      mode: mode === 'public' ? 'public' : 'private'
    };
    socket.join(code);
    socket.roomCode = code;
    callback({ success: true, code, players: getPlayerList(code) });
  });

  socket.on('joinRoom', (code, callback) => {
    const room = rooms[code];
    if (!room) {
      return callback({ success: false, message: 'Room not found! Check the code.' });
    }
    if (Object.keys(room.players).length >= room.maxPlayers) {
      return callback({ success: false, message: 'Room is full! Maximum 4 players.' });
    }
    if (getTotalPlayers() >= MAX_PLAYERS) {
      return callback({ success: false, message: 'Server is full (1000 players reach)! Please try again later.' });
    }
    if (room.started) {
      return callback({ success: false, message: 'Game already in progress!' });
    }

    room.players[socket.id] = {
      name: playerStats[socket.id]?.name || 'Player',
      guesses: [],
      guessedCorrectly: false,
      score: 0
    };

    socket.join(code);
    socket.roomCode = code;

    // Notify all players in room
    io.to(code).emit('playerJoined', getPlayerList(code));
    
    // Auto-start for public rooms if full (4 players)
    if (room.mode === 'public' && Object.keys(room.players).length === 4) {
      room.started = true;
      io.to(code).emit('gameStarted');
      startNewRound(code);
    }

    callback({ success: true, code, players: getPlayerList(code), isCreator: false, mode: room.mode });
  });

  socket.on('joinOnline', (callback) => {
    // Scaling Protection: Limit total players
    if (getTotalPlayers() >= MAX_PLAYERS) {
      return callback?.({ success: false, message: 'Server is full (1000 players reached)! Please try again later.' });
    }

    // 1. Find an existing public room that hasn't started and isn't full
    let targetRoom = Object.values(rooms).find(r => 
      r.mode === 'public' && !r.started && Object.keys(r.players).length < 4
    );

    if (targetRoom) {
      // Join existing room
      const code = targetRoom.code;
      targetRoom.players[socket.id] = {
        name: playerStats[socket.id]?.name || 'Player',
        guesses: [],
        guessedCorrectly: false,
        score: 0
      };
      socket.join(code);
      socket.roomCode = code;
      io.to(code).emit('playerJoined', getPlayerList(code));
      
      // Auto-start check
      if (Object.keys(targetRoom.players).length === 4) {
        targetRoom.started = true;
        io.to(code).emit('gameStarted');
        setTimeout(() => startNewRound(code), 1000); // Small delay for UI
      }

      callback({ success: true, code, players: getPlayerList(code), mode: 'public' });
    } else {
      // 2. Create a new public room with random settings
      const code = generateRoomCode();
      const lengths = [5, 6, 7];
      const diffs = ['easy', 'medium', 'hard'];
      
      rooms[code] = {
        code,
        creator: socket.id,
        wordLength: lengths[Math.floor(Math.random() * lengths.length)],
        difficulty: diffs[Math.floor(Math.random() * diffs.length)],
        players: {
          [socket.id]: {
            name: playerStats[socket.id]?.name || 'Player',
            guesses: [],
            guessedCorrectly: false,
            score: 0
          }
        },
        currentWord: null,
        round: 0,
        roundWinner: null,
        roundStartTime: null,
        timer: null,
        started: false,
        maxPlayers: 4,
        mode: 'public'
      };
      socket.join(code);
      socket.roomCode = code;
      callback({ success: true, code, players: getPlayerList(code), mode: 'public' });
    }
  });

  socket.on('startGame', (callback) => {
    const code = socket.roomCode;
    const room = rooms[code];
    if (!room) return callback?.({ success: false, message: 'Room not found.' });
    if (room.creator !== socket.id) return callback?.({ success: false, message: 'Only the creator can start.' });
    if (Object.keys(room.players).length < 2) return callback?.({ success: false, message: 'Need at least 2 players.' });

    room.started = true;
    io.to(code).emit('gameStarted');
    startNewRound(code);
    callback?.({ success: true });
  });

  socket.on('submitGuess', (word, callback) => {
    const code = socket.roomCode;
    const room = rooms[code];
    if (!room || !room.started || !room.currentWord) {
      return callback?.({ success: false, message: 'Game not active.' });
    }

    const player = room.players[socket.id];
    if (!player) return callback?.({ success: false, message: 'Not in room.' });
    if (player.guessedCorrectly) return callback?.({ success: false, message: 'You already guessed the word!' });

    const guess = word.toLowerCase().trim();

    // Validate: only alphabets
    if (!/^[a-z]+$/.test(guess)) {
      return callback?.({ success: false, message: 'Write only alphabets!' });
    }

    // Validate: correct length
    if (guess.length !== room.wordLength) {
      return callback?.({ success: false, message: `Word must be ${room.wordLength} letters!` });
    }

    // Validate: meaningful word
    if (!isValidWord(guess)) {
      return callback?.({ success: false, message: 'Write meaningful words!' });
    }

    // Compare with target
    let colors = compareWords(guess, room.currentWord);

    const isCorrect = guess === room.currentWord.toLowerCase();
    
    player.guesses.push({ word: guess, colors });

    if (isCorrect) {
      player.guessedCorrectly = true;
      player.score++;
      if (playerStats[socket.id]) {
        playerStats[socket.id].wordsGuessed++;
        playerStats[socket.id].gamesWon++;
      }

      // Update stats for all players
      for (const pid of Object.keys(room.players)) {
        if (playerStats[pid]) playerStats[pid].gamesPlayed++;
      }

      room.roundWinner = socket.id;

      // Notify winner
      callback?.({
        success: true,
        colors,
        correct: true,
        message: 'Congratulations you have won!'
      });

      // Notify all players
      io.to(code).emit('roundEnd', {
        word: room.currentWord,
        winner: playerStats[socket.id]?.name || 'Player',
        message: `${playerStats[socket.id]?.name || 'Player'} guessed the word "${room.currentWord.toUpperCase()}"!`
      });

      clearInterval(room.timer);
      setTimeout(() => startNewRound(code), 4000);
    } else {
      callback?.({ success: true, colors, correct: false });
    }

    // Broadcast updated guess count to other players
    io.to(code).emit('playerUpdate', getPlayerList(code));
  });

  socket.on('leaveRoom', () => {
    handlePlayerLeave(socket);
  });

  socket.on('getStats', (callback) => {
    callback?.(playerStats[socket.id] || { name: 'Player', wordsGuessed: 0, gamesWon: 0, gamesPlayed: 0 });
  });

  socket.on('disconnect', () => {
    handlePlayerLeave(socket);
    delete playerStats[socket.id];
    delete socketRateLimits[socket.id];
    console.log('Player disconnected:', socket.id);
  });
});

function getPlayerList(code) {
  const room = rooms[code];
  if (!room) return [];
  return Object.entries(room.players).map(([id, p]) => ({
    id,
    name: p.name,
    guessCount: p.guesses.length,
    guessedCorrectly: p.guessedCorrectly,
    score: p.score,
    isCreator: id === room.creator
  }));
}

function handlePlayerLeave(socket) {
  const code = socket.roomCode;
  if (!code || !rooms[code]) return;

  const room = rooms[code];
  delete room.players[socket.id];
  socket.leave(code);
  socket.roomCode = null;

  if (Object.keys(room.players).length === 0) {
    // Room empty, clean up
    if (room.timer) clearInterval(room.timer);
    delete rooms[code];
  } else {
    // If creator left, assign new creator
    if (room.creator === socket.id) {
      room.creator = Object.keys(room.players)[0];
    }
    io.to(code).emit('playerLeft', {
      players: getPlayerList(code),
      name: playerStats[socket.id]?.name || 'Player'
    });
  }
}

// Health Check for cloud monitoring
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).send('Something broke! We are looking into it.');
});

// Process Crash Protection
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WordGuess server running at http://localhost:${PORT}`);
});
