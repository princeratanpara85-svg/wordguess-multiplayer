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

function getRandomWord(length, difficulty) {
  const words = targetWords[length]?.[difficulty];
  if (!words || words.length === 0) return null;
  return words[Math.floor(Math.random() * words.length)];
}

function isValidWord(word) {
  // Use the pre-calculated Set for O(1) lookup with zero extra memory overhead
  return allValidWords.has(word.toLowerCase());
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
