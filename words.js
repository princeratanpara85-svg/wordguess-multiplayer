// WordGuess - Word Dictionary
// Simplified for daily using words only
// Organized by length (5, 6, 7) and difficulty (relative)

const targetWords = {
  5: {
    easy: [
      'apple', 'beach', 'bread', 'chair', 'dance', 'earth', 'flame', 'grape',
      'horse', 'juice', 'lemon', 'mango', 'night', 'ocean', 'piano', 'queen',
      'river', 'smile', 'tiger', 'urban', 'water', 'youth', 'angel', 'berry',
      'cloud', 'dream', 'fairy', 'green', 'happy', 'jelly', 'light', 'magic',
      'paint', 'radio', 'sugar', 'train', 'voice', 'world', 'brain', 'candy'
    ],
    medium: [
      'about', 'above', 'adult', 'after', 'again', 'alone', 'along', 'basic',
      'below', 'black', 'blind', 'board', 'bring', 'build', 'carry', 'child',
      'clean', 'clear', 'close', 'color', 'count', 'cover', 'daily', 'dirty',
      'drink', 'early', 'empty', 'entry', 'every', 'field', 'floor', 'glass'
    ],
    hard: [
      'guide', 'heart', 'heavy', 'house', 'image', 'index', 'large', 'learn',
      'level', 'local', 'lucky', 'money', 'month', 'music', 'never', 'order',
      'paper', 'party', 'phone', 'photo', 'piece', 'pilot', 'place', 'point',
      'power', 'press', 'price', 'proud', 'quick', 'quiet', 'raise', 'reach'
    ]
  },
  6: {
    easy: [
      'animal', 'banana', 'basket', 'bridge', 'butter', 'candle', 'castle',
      'cattle', 'center', 'change', 'cheese', 'cherry', 'choice', 'circle',
      'coffee', 'cookie', 'corner', 'cotton', 'create', 'design', 'dinner',
      'dragon', 'driver', 'engine', 'family', 'finger', 'flower', 'forest'
    ],
    medium: [
      'garden', 'gentle', 'ginger', 'global', 'golden', 'guitar', 'hammer',
      'heaven', 'hidden', 'hunger', 'island', 'jungle', 'kitten', 'ladder',
      'launch', 'leader', 'lesson', 'letter', 'little', 'london', 'marker',
      'master', 'mirror', 'mother', 'muscle', 'nature', 'needle', 'number'
    ],
    hard: [
      'orange', 'palace', 'parrot', 'people', 'planet', 'pocket', 'purple',
      'rabbit', 'random', 'recipe', 'rescue', 'ribbon', 'rocket', 'rubber',
      'silver', 'simple', 'sister', 'smooth', 'spider', 'spring', 'square',
      'stream', 'street', 'summer', 'sunset', 'switch', 'temple', 'window'
    ]
  },
  7: {
    easy: [
      'amazing', 'balloon', 'blanket', 'brother', 'cabinet', 'captain',
      'chapter', 'chicken', 'chimney', 'college', 'comfort', 'company',
      'connect', 'contain', 'country', 'courage', 'curtain', 'cushion',
      'deliver', 'diamond', 'display', 'dolphin', 'element', 'evening'
    ],
    medium: [
      'example', 'excited', 'explore', 'factory', 'feather', 'finally',
      'flannel', 'flutter', 'forever', 'freedom', 'gallery', 'general',
      'giraffe', 'glimpse', 'goodbye', 'gorilla', 'harvest', 'highway',
      'history', 'holiday', 'husband', 'imagine', 'journey', 'kitchen'
    ],
    hard: [
      'lantern', 'leopard', 'liberty', 'machine', 'missile', 'monster',
      'morning', 'mystery', 'natural', 'nothing', 'outside', 'package',
      'painter', 'panther', 'pattern', 'penguin', 'perfect', 'picture',
      'quality', 'rainbow', 'scatter', 'shelter', 'soldier', 'sparkle'
    ]
  }
};

// Pre-calculate a Set of all valid words for instant, memory-efficient lookups
const allValidWords = new Set();
Object.values(targetWords).forEach(lengths => {
  Object.values(lengths).forEach(wordList => {
    wordList.forEach(word => allValidWords.add(word.toLowerCase()));
  });
});

const https = require('https');

// Memory-efficient cache for API validation (Max 100 entries to prevent memory growth)
const validationCache = new Map();
const MAX_CACHE_SIZE = 100;

function getRandomWord(length, difficulty) {
  const words = targetWords[length]?.[difficulty];
  if (!words || words.length === 0) return null;
  return words[Math.floor(Math.random() * words.length)];
}

async function isValidWord(word) {
  const lowerWord = word.toLowerCase();
  
  // 1. Instant check against local high-quality "daily life" words
  if (allValidWords.has(lowerWord)) return true;
  
  // 2. Check memory-efficient validation cache
  if (validationCache.has(lowerWord)) return validationCache.get(lowerWord);
  
  // 3. API Fallback for words like "enters", "creates", "corners"
  return new Promise((resolve) => {
    // Set a timeout of 2 seconds to ensure game doesn't hang if API is slow
    const request = https.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${lowerWord}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const isValid = res.statusCode === 200;
        
        // Maintain cache size
        if (validationCache.size >= MAX_CACHE_SIZE) {
          const firstKey = validationCache.keys().next().value;
          validationCache.delete(firstKey);
        }
        validationCache.set(lowerWord, isValid);
        
        resolve(isValid);
      });
    });

    request.on('error', () => {
      // Default to true if API is unreachable to not block user
      resolve(true); 
    });

    request.setTimeout(2000, () => {
      request.destroy();
      resolve(true);
    });
  });
}

function getDuplicateLetterInfo(word) {
  const letterCount = {};
  for (const letter of word.toLowerCase()) {
    letterCount[letter] = (letterCount[letter] || 0) + 1;
  }
  const duplicates = [];
  for (const [letter, count] of Object.entries(letterCount)) {
    if (count > 1) {
      const countWords = ['zero', 'one', 'two', 'three', 'four', 'five'];
      duplicates.push({ letter: letter.toUpperCase(), count, countWord: countWords[count] || count.toString() });
    }
  }
  return duplicates;
}

module.exports = { getRandomWord, isValidWord, getDuplicateLetterInfo };
