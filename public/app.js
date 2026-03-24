// ═══════════════════════════════════════════════════════
// WORDGUESS — Frontend Application
// ═══════════════════════════════════════════════════════

const socket = io();

// ── State ────────────────────────────────────────────
let currentScreen = 'homeScreen';
let playerName = localStorage.getItem('wordguess_name') || '';
let roomCode = null;
let isCreator = false;
let wordLength = 5;
let difficulty = 'easy';
let currentInput = [];
let roundActive = false;
let hasGuessedCorrectly = false;

// ── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initFloatingWords();
  initEventListeners();
  if (playerName) {
    document.getElementById('playerNameInput').value = playerName;
    socket.emit('setName', playerName);
  }
  // Keyboard input for game
  document.addEventListener('keydown', handleKeydown);
});

function initEventListeners() {
  // Home Screen
  document.getElementById('btnPlayOnline').addEventListener('click', joinOnlineMode);
  document.getElementById('btnPlayFriends').addEventListener('click', () => showScreen('lobbyScreen'));
  document.getElementById('btnProfile').addEventListener('click', () => openModal('profileModal'));
  document.getElementById('btnHowToPlay').addEventListener('click', () => openModal('howToPlayModal'));
  document.getElementById('btnExit').addEventListener('click', exitGame);

  // Lobby Screen
  document.getElementById('btnCreate').addEventListener('click', showCreateOptions);
  document.getElementById('btnJoin').addEventListener('click', showJoinOptions);
  document.getElementById('btnLobbyBack').addEventListener('click', () => showScreen('homeScreen'));
  document.getElementById('btnCreateBack').addEventListener('click', backToLobbyChoice);
  document.getElementById('btnJoinBack').addEventListener('click', backToLobbyChoice);
  document.getElementById('btnOnlineLobbyBack').addEventListener('click', leaveRoom);

  // Game Creation
  document.getElementById('btnCreateGame').addEventListener('click', createGame);
  document.querySelectorAll('#wordLengthOptions .opt-btn').forEach(btn => {
    btn.addEventListener('click', () => selectOption(btn, 'wordLength'));
  });
  document.querySelectorAll('#difficultyOptions .opt-btn').forEach(btn => {
    btn.addEventListener('click', () => selectOption(btn, 'difficulty'));
  });

  // Join Room
  document.getElementById('btnJoinGame').addEventListener('click', joinGame);
  document.getElementById('btnCopyCode').addEventListener('click', copyRoomCode);
  document.getElementById('btnStartGame').addEventListener('click', startGame);
  document.getElementById('btnLeaveRoom').addEventListener('click', leaveRoom);

  // Game Play
  document.getElementById('btnSubmitGuess').addEventListener('click', submitGuess);
  document.getElementById('btnClearGuess').addEventListener('click', clearInput);
  document.getElementById('btnExitMatch').addEventListener('click', exitMatch);

  // Modals
  document.getElementById('btnCloseProfile').addEventListener('click', () => closeModal('profileModal'));
  document.getElementById('btnSaveProfile').addEventListener('click', saveProfile);
  document.getElementById('btnCloseHowToPlay').addEventListener('click', () => closeModal('howToPlayModal'));

  // Exit Screen
  document.getElementById('btnExitBackHome').addEventListener('click', () => showScreen('homeScreen'));
}

// ══════════════════════════════════════════════════════
//  FLOATING WORD BACKGROUND
// ══════════════════════════════════════════════════════
const bgWords = [
  'GUESS', 'WORDS', 'PLAY', 'THINK', 'BRAIN', 'SMART', 'CLUE', 'SOLVE',
  'MATCH', 'ROUND', 'SCORE', 'LEVEL', 'BONUS', 'QUEST', 'SPARK', 'DREAM',
  'MAGIC', 'POWER', 'SHINE', 'BLAZE', 'STORM', 'FLASH', 'QUICK', 'SHARP',
  'CROWN', 'PRIDE', 'CHAMP', 'GLORY', 'ROYAL', 'ELITE', 'FROST', 'FLAME',
  'OCEAN', 'TIGER', 'EAGLE', 'NIGHT', 'LIGHT', 'SPACE', 'HEART', 'STONE',
  'HAPPY', 'SMILE', 'LAUGH', 'DANCE', 'MUSIC', 'PARTY', 'WORLD', 'GRAPE',
  'APPLE', 'LEMON', 'MANGO', 'BERRY', 'EARTH', 'POINT', 'CANDY', 'LUCKY'
];

function initFloatingWords() {
  const container = document.getElementById('wordBackground');
  container.innerHTML = '';

  function spawnWord() {
    const word = document.createElement('span');
    word.className = 'floating-word';
    word.textContent = bgWords[Math.floor(Math.random() * bgWords.length)];

    const x = Math.random() * 95;
    const duration = 12 + Math.random() * 15; // Slightly slower for elegance
    const rotate = -15 + Math.random() * 30;
    const size = 0.8 + Math.random() * 1.5;
    const opacity = 0.03 + Math.random() * 0.08;

    word.style.left = `${x}%`;
    word.style.bottom = '-60px';
    word.style.setProperty('--rotate', `${rotate}deg`);
    word.style.fontSize = `${size}rem`;
    word.style.opacity = opacity;
    word.style.animationDuration = `${duration}s`;
    word.style.animationName = 'floatWord';
    word.style.animationIterationCount = '1';
    word.style.animationTimingFunction = 'linear';

    container.appendChild(word);
    setTimeout(() => word.remove(), duration * 1000);
  }

  // Initial batch
  for (let i = 0; i < 30; i++) {
    setTimeout(() => spawnWord(), i * 300);
  }
  // Constant spawning
  window.bgInterval = setInterval(spawnWord, 1800);
}

function stopFloatingWords() {
  if (window.bgInterval) clearInterval(window.bgInterval);
  document.getElementById('wordBackground').innerHTML = '';
}

function startFloatingWords() {
  if (window.bgInterval) clearInterval(window.bgInterval);
  initFloatingWords();
}

// ══════════════════════════════════════════════════════
//  SCREEN MANAGEMENT
// ══════════════════════════════════════════════════════
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  currentScreen = screenId;
}

function showCreateOptions() {
  document.getElementById('lobbyChoice').classList.add('hidden');
  document.getElementById('createOptions').classList.remove('hidden');
}

function showJoinOptions() {
  document.getElementById('lobbyChoice').classList.add('hidden');
  document.getElementById('joinOptions').classList.remove('hidden');
}

function backToLobbyChoice() {
  document.getElementById('createOptions').classList.add('hidden');
  document.getElementById('joinOptions').classList.add('hidden');
  document.getElementById('waitingRoom').classList.add('hidden');
  document.getElementById('lobbyChoice').classList.remove('hidden');
}

// ══════════════════════════════════════════════════════
//  MODAL MANAGEMENT
// ══════════════════════════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  if (id === 'profileModal') {
    socket.emit('getStats', (stats) => {
      document.getElementById('statWordsGuessed').textContent = stats.wordsGuessed || 0;
      document.getElementById('statGamesWon').textContent = stats.gamesWon || 0;
      document.getElementById('statGamesPlayed').textContent = stats.gamesPlayed || 0;
    });
  }
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ══════════════════════════════════════════════════════
//  OPTION SELECTION
// ══════════════════════════════════════════════════════
function selectOption(btn, type) {
  btn.parentElement.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (type === 'wordLength') wordLength = parseInt(btn.dataset.value);
  if (type === 'difficulty') difficulty = btn.dataset.value;
}

// ══════════════════════════════════════════════════════
//  PROFILE
// ══════════════════════════════════════════════════════
function saveProfile() {
  const name = document.getElementById('playerNameInput').value.trim();
  if (!name) {
    showToast('Please enter a name!');
    return;
  }
  playerName = name;
  localStorage.setItem('wordguess_name', name);
  socket.emit('setName', name);
  closeModal('profileModal');
  showToast('Profile saved! 🎉');
}

// ══════════════════════════════════════════════════════
//  GAME CREATION & JOINING
// ══════════════════════════════════════════════════════
function createGame() {
  if (!playerName) {
    showToast('Set your name in Profile first!');
    return;
  }
  socket.emit('createRoom', { wordLength, difficulty }, (res) => {
    if (res.success) {
      roomCode = res.code;
      isCreator = true;
      showWaitingRoom(res.code, res.players, true);
    }
  });
}

function joinOnlineMode() {
  if (!playerName) {
    showToast('Set your name in Profile first!');
    openModal('profileModal');
    return;
  }
  socket.emit('joinOnline', (res) => {
    if (res.success) {
      roomCode = res.code;
      isCreator = false;
      showWaitingRoom(res.code, res.players, false, 'public');
    } else {
      showToast(res.message);
    }
  });
}

function joinGame() {
  if (!playerName) {
    showToast('Set your name in Profile first!');
    return;
  }
  const code = document.getElementById('joinCodeInput').value.trim();
  if (code.length !== 6) {
    showToast('Enter a valid 6-digit code!');
    return;
  }
  socket.emit('joinRoom', code, (res) => {
    if (res.success) {
      roomCode = res.code;
      isCreator = false;
      showWaitingRoom(res.code, res.players, false);
    } else {
      showToast(res.message);
    }
  });
}

function showWaitingRoom(code, players, creator, mode = 'private') {
  // Hide all lobby sections first
  document.getElementById('createOptions').classList.add('hidden');
  document.getElementById('joinOptions').classList.add('hidden');
  document.getElementById('lobbyChoice').classList.add('hidden');
  document.getElementById('onlineLobbyScreen').classList.add('hidden');
  document.getElementById('waitingRoom').classList.add('hidden');

  if (mode === 'public') {
    document.getElementById('onlineLobbyScreen').classList.remove('hidden');
    updateOnlineSlots(players);
  } else {
    document.getElementById('waitingRoom').classList.remove('hidden');
    document.getElementById('displayRoomCode').textContent = code;
    updatePlayerList(players);
    if (creator) {
      document.getElementById('btnStartGame').classList.remove('hidden');
    } else {
      document.getElementById('btnStartGame').classList.add('hidden');
    }
  }

  showScreen('lobbyScreen');
}

function updateOnlineSlots(players) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`slot-${i}`);
    slot.innerHTML = '';
    slot.classList.remove('filled');

    if (players[i]) {
      slot.classList.add('filled');
      slot.innerHTML = `<span class="slot-name">${escapeHtml(players[i].name)}</span>`;
    } else {
      const char = chars[Math.floor(Math.random() * chars.length)];
      slot.innerHTML = `<div class="slot-loading"><span class="loading-char">${char}</span></div>`;
    }
  }
  
  const statusText = document.getElementById('onlineStatusText');
  if (players.length < 4) {
    statusText.textContent = `Waiting for players (${players.length}/4)...`;
  } else {
    statusText.textContent = 'Match found! Starting...';
  }
}

function updatePlayerList(players) {
  const list = document.getElementById('playerList');
  list.innerHTML = players.map(p => `
    <div class="player-item">
      <span class="player-name">
        ${escapeHtml(p.name)}
        ${p.isCreator ? '<span class="player-badge">Host</span>' : ''}
      </span>
      <span style="color: var(--text-muted);">Score: ${p.score}</span>
    </div>
  `).join('');
  document.getElementById('playerCountText').textContent = `${players.length}/4 Players`;
}

function startGame() {
  socket.emit('startGame', (res) => {
    if (!res.success) showToast(res.message);
  });
}

function leaveRoom() {
  socket.emit('leaveRoom');
  roomCode = null;
  isCreator = false;
  
  // Reset UI
  document.getElementById('onlineLobbyScreen').classList.add('hidden');
  document.getElementById('waitingRoom').classList.add('hidden');
  document.getElementById('lobbyChoice').classList.remove('hidden');
  
  showScreen('homeScreen');
}

function copyRoomCode() {
  navigator.clipboard.writeText(roomCode || '').then(() => {
    showToast('Code copied! 📋');
  }).catch(() => {
    showToast('Copy the code: ' + roomCode);
  });
}

// ══════════════════════════════════════════════════════
//  GAME PLAY
// ══════════════════════════════════════════════════════
function initGameUI(wLength) {
  wordLength = wLength;
  currentInput = [];
  hasGuessedCorrectly = false;
  document.getElementById('guessGrid').innerHTML = '';
  document.getElementById('gameMessage').classList.add('hidden');
  document.getElementById('inputError').classList.add('hidden');
  document.getElementById('winOverlay').classList.add('hidden');
  createLetterBoxes();
  renderVirtualKeyboard();

  document.getElementById('virtualKeyboard').classList.remove('hidden');
  document.getElementById('letterBoxes').classList.remove('hidden');
  document.getElementById('btnSubmitGuess').classList.remove('hidden');
  document.getElementById('btnClearGuess').classList.remove('hidden');
  
  // Anti-Cheat: Stop floating words during game
  stopFloatingWords();
}


function renderVirtualKeyboard() {
  const container = document.getElementById('virtualKeyboard');
  container.innerHTML = '';
  
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
  ];
  
  rows.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'key-row';
    
    row.forEach(keyChar => {
      const keyBtn = document.createElement('button');
      keyBtn.className = 'key';
      keyBtn.textContent = keyChar;
      
      if (keyChar === 'ENTER') {
        keyBtn.classList.add('special', 'enter');
        keyBtn.onclick = () => submitGuess();
      } else if (keyChar === 'DEL') {
        keyBtn.classList.add('special', 'delete');
        keyBtn.onclick = () => handleBackspace();
      } else {
        keyBtn.onclick = () => handleKeyInput(keyChar);
      }
      
      rowDiv.appendChild(keyBtn);
    });
    container.appendChild(rowDiv);
  });
}

function handleKeyInput(keyChar) {
  if (!roundActive || hasGuessedCorrectly) return;
  const emptyIdx = currentInput.indexOf('');
  if (emptyIdx !== -1) {
    currentInput[emptyIdx] = keyChar.toUpperCase();
    updateLetterBoxes();
  }
}

function handleBackspace() {
  if (!roundActive || hasGuessedCorrectly) return;
  for (let i = wordLength - 1; i >= 0; i--) {
    if (currentInput[i]) {
      currentInput[i] = '';
      updateLetterBoxes();
      return;
    }
  }
}

function createLetterBoxes() {
  const container = document.getElementById('letterBoxes');
  container.innerHTML = '';
  for (let i = 0; i < wordLength; i++) {
    const box = document.createElement('div');
    box.className = 'letter-box' + (i === 0 ? ' active' : '');
    box.dataset.index = i;
    container.appendChild(box);
  }
  currentInput = new Array(wordLength).fill('');
}

function handleKeydown(e) {
  if (currentScreen !== 'gameScreen' || !roundActive || hasGuessedCorrectly) return;

  // Ignore if modal is open
  if (!document.getElementById('profileModal').classList.contains('hidden')) return;
  if (!document.getElementById('howToPlayModal').classList.contains('hidden')) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    submitGuess();
    return;
  }

  if (e.key === 'Backspace') {
    e.preventDefault();
    handleBackspace();
    return;
  }

  // Only accept alphabets
  if (/^[a-zA-Z]$/.test(e.key)) {
    e.preventDefault();
    handleKeyInput(e.key);
  }
}

function updateLetterBoxes() {
  const boxes = document.querySelectorAll('.letter-box');
  const firstEmpty = currentInput.indexOf('');

  boxes.forEach((box, i) => {
    box.textContent = currentInput[i] || '';
    box.classList.toggle('filled', !!currentInput[i]);
    box.classList.toggle('active', i === (firstEmpty === -1 ? wordLength : firstEmpty));
  });
}

function clearInput() {
  currentInput = new Array(wordLength).fill('');
  updateLetterBoxes();
  hideError();
}

function submitGuess() {
  if (!roundActive || hasGuessedCorrectly) return;

  const word = currentInput.join('');

  if (word.length !== wordLength) {
    showError(`Fill all ${wordLength} letters!`);
    return;
  }

  if (!/^[A-Za-z]+$/.test(word)) {
    showError('Write only alphabets!');
    return;
  }

  hideError();

  socket.emit('submitGuess', word.toLowerCase(), (res) => {
    if (!res.success) {
      showError(res.message);
      return;
    }

    // Add guess to grid
    addGuessRow(word, res.colors);
    clearInput();

    if (res.correct) {
      hasGuessedCorrectly = true;
      showWinOverlay(res.message);
    }
  });
}

function addGuessRow(word, colors) {
  const grid = document.getElementById('guessGrid');
  const row = document.createElement('div');
  row.className = 'guess-row';

  for (let i = 0; i < word.length; i++) {
    const cell = document.createElement('div');
    cell.className = `guess-letter ${colors[i]}`;
    cell.textContent = word[i].toUpperCase();
    cell.style.animationDelay = `${i * 0.08}s`;
    row.appendChild(cell);
  }

  grid.appendChild(row);
  // Auto-scroll to bottom
  grid.scrollTop = grid.scrollHeight;
}

function showError(msg) {
  const el = document.getElementById('inputError');
  el.textContent = msg;
  el.classList.remove('hidden');
  // Re-trigger animation
  el.style.animation = 'none';
  el.offsetHeight; // force reflow
  el.style.animation = 'shake 0.4s ease';
}

function hideError() {
  document.getElementById('inputError').classList.add('hidden');
}

function showGameMessage(msg, type) {
  const el = document.getElementById('gameMessage');
  el.textContent = msg;
  el.className = `game-message ${type}`;
}

function showWinOverlay(message) {
  const overlay = document.getElementById('winOverlay');
  document.getElementById('winMessage').textContent = '🎉 Congratulations!';
  document.getElementById('winSubMessage').textContent = message || 'You guessed the word!';
  overlay.classList.remove('hidden');
}

function updateGamePlayers(players) {
  const container = document.getElementById('gamePlayers');
  container.innerHTML = players.map(p => `
    <div class="game-player-card ${p.guessedCorrectly ? 'won' : ''}">
      <div class="game-player-name">
        ${p.guessedCorrectly ? '🏆 ' : ''}${escapeHtml(p.name)}
        ${p.isCreator ? ' <span class="player-badge">Host</span>' : ''}
      </div>
      <div class="game-player-info">
        <span>Guesses: ${p.guessCount}</span>
        <span>Score: ${p.score}</span>
      </div>
    </div>
  `).join('');
}

function exitMatch() {
  socket.emit('leaveRoom');
  roomCode = null;
  roundActive = false;
  startFloatingWords(); // Resume floating words
  showScreen('homeScreen');
}

function exitGame() {
  showScreen('exitScreen');
}

// ══════════════════════════════════════════════════════
//  SOCKET EVENT HANDLERS
// ══════════════════════════════════════════════════════
socket.on('playerJoined', (players) => {
  // Check if we are in online lobby or private lobby
  if (!document.getElementById('onlineLobbyScreen').classList.contains('hidden')) {
    updateOnlineSlots(players);
  } else {
    updatePlayerList(players);
  }
});

socket.on('playerLeft', (data) => {
  if (!document.getElementById('onlineLobbyScreen').classList.contains('hidden')) {
    updateOnlineSlots(data.players);
  } else {
    updatePlayerList(data.players);
  }
  if (currentScreen === 'gameScreen') {
    updateGamePlayers(data.players);
  }
  showToast(`${data.name} left the game`);
});

socket.on('gameStarted', () => {
  showScreen('gameScreen');
});socket.on('roundStart', (data) => {
  roundActive = true;
  hasGuessedCorrectly = false;
  wordLength = data.wordLength;
  initGameUI(data.wordLength);
  document.getElementById('roundNumber').textContent = data.round;

  // Show duplicate hint
  const dupeEl = document.getElementById('dupeHint');
  if (data.dupeMessage) {
    dupeEl.textContent = '🔤 ' + data.dupeMessage;
    dupeEl.classList.remove('hidden');
  } else {
    dupeEl.classList.add('hidden');
  }

  showGameMessage(`Round ${data.round} — Guess the ${data.wordLength}-letter word!`, 'info');
});

socket.on('timerUpdate', (timeLeft) => {
  const fill = document.getElementById('timerFill');
  const text = document.getElementById('timerText');
  const pct = (timeLeft / 90) * 100;
  fill.style.width = `${pct}%`;
  text.textContent = `${timeLeft}s`;

  fill.classList.remove('warning', 'danger');
  if (timeLeft <= 15) fill.classList.add('danger');
  else if (timeLeft <= 30) fill.classList.add('warning');
});

socket.on('roundEnd', (data) => {
  roundActive = false;

  if (data.winner) {
    showGameMessage(`🏆 ${data.message}`, 'success');
  } else {
    showGameMessage(data.message, 'warning');
  }
});

socket.on('playerUpdate', (players) => {
  if (currentScreen === 'gameScreen') {
    updateGamePlayers(players);
  } else if (!document.getElementById('onlineLobbyScreen').classList.contains('hidden')) {
    updateOnlineSlots(players);
  }
});

// ══════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>✨</span> ${message}`;
  document.body.appendChild(toast);
  
  // Trigger entry animation
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
