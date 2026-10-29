const OPEN_TDB_URL = 'https://opentdb.com/api.php';
const WORD_API_BASE = 'https://wordsohard.com/api/v1';

const MULTIPLE_FALLBACK = [
  { category: 'Science', difficulty: 'easy', question: 'Which planet is known as the Red Planet?', correctAnswer: 'Mars', incorrectAnswers: ['Venus', 'Jupiter', 'Mercury'] },
  { category: 'Science', difficulty: 'easy', question: 'What is the chemical symbol for water?', correctAnswer: 'H2O', incorrectAnswers: ['CO2', 'O2', 'NaCl'] },
  { category: 'Geography', difficulty: 'easy', question: 'Which is the largest ocean on Earth?', correctAnswer: 'Pacific Ocean', incorrectAnswers: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'] },
  { category: 'Animals', difficulty: 'easy', question: 'Which animal is the tallest in the world?', correctAnswer: 'Giraffe', incorrectAnswers: ['Elephant', 'Ostrich', 'Camel'] },
  { category: 'General Knowledge', difficulty: 'easy', question: 'How many sides does a hexagon have?', correctAnswer: 'Six', incorrectAnswers: ['Five', 'Seven', 'Eight'] },
  { category: 'Science', difficulty: 'easy', question: 'What gas do plants absorb from the atmosphere?', correctAnswer: 'Carbon dioxide', incorrectAnswers: ['Oxygen', 'Helium', 'Hydrogen'] },
  { category: 'Geography', difficulty: 'easy', question: 'Which country is famous for the pyramids of Giza?', correctAnswer: 'Egypt', incorrectAnswers: ['Greece', 'Mexico', 'India'] },
  { category: 'General Knowledge', difficulty: 'easy', question: 'How many minutes are in one hour?', correctAnswer: '60', incorrectAnswers: ['30', '45', '90'] },
  { category: 'Science', difficulty: 'easy', question: 'Which organ pumps blood around the human body?', correctAnswer: 'Heart', incorrectAnswers: ['Lungs', 'Stomach', 'Kidneys'] },
  { category: 'General Knowledge', difficulty: 'easy', question: 'What is the opposite of the word "ancient"?', correctAnswer: 'Modern', incorrectAnswers: ['Old', 'Historic', 'Past'] },
];

const BOOLEAN_FALLBACK = [
  { category: 'Science', difficulty: 'easy', question: 'The Earth orbits the Sun.', correctAnswer: 'True', incorrectAnswers: ['False'] },
  { category: 'Science', difficulty: 'easy', question: 'Humans have three lungs.', correctAnswer: 'False', incorrectAnswers: ['True'] },
  { category: 'Geography', difficulty: 'easy', question: 'The Pacific Ocean is larger than the Atlantic Ocean.', correctAnswer: 'True', incorrectAnswers: ['False'] },
  { category: 'Animals', difficulty: 'easy', question: 'A bat is a mammal.', correctAnswer: 'True', incorrectAnswers: ['False'] },
  { category: 'Science', difficulty: 'easy', question: 'Water freezes at 0 degrees Celsius under standard conditions.', correctAnswer: 'True', incorrectAnswers: ['False'] },
  { category: 'Science', difficulty: 'easy', question: 'The Sun is a planet.', correctAnswer: 'False', incorrectAnswers: ['True'] },
  { category: 'General Knowledge', difficulty: 'easy', question: 'A triangle has four sides.', correctAnswer: 'False', incorrectAnswers: ['True'] },
  { category: 'Science', difficulty: 'easy', question: 'Sound travels faster than light.', correctAnswer: 'False', incorrectAnswers: ['True'] },
];

const WORD_BANK = [
  'planet', 'orange', 'garden', 'school', 'bridge', 'camera', 'puzzle',
  'future', 'window', 'rocket', 'forest', 'silver', 'castle', 'bottle',
  'pencil', 'animal', 'circle', 'family',
];

const OFFLINE_DEFINITIONS = {
  planet: 'A large round object in space that orbits a star.',
  orange: 'A round citrus fruit with a tough orange skin.',
  garden: 'A piece of land used for growing flowers or plants.',
  school: 'A place where students go to learn.',
  bridge: 'A structure built over a river, road, or gap.',
  camera: 'A device used to take photographs or record video.',
  puzzle: 'A game or problem that tests your ability to think.',
  future: 'The time that has not happened yet.',
  window: 'An opening in a wall, usually with glass.',
  rocket: 'A vehicle that can travel through space.',
  forest: 'A large area covered mainly with trees.',
  silver: 'A shiny, grey-white precious metal.',
  castle: 'A large, strong building made to defend a place.',
  bottle: 'A container with a narrow neck used to hold liquids.',
  pencil: 'A tool for writing or drawing, usually with graphite.',
  animal: 'A living creature that is not a plant.',
  circle: 'A round shape whose points are equally distant from its center.',
  family: 'A group of people related to one another.',
};

export function shuffleArray(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    quot: '"',
    lt: '<',
    gt: '>',
    nbsp: ' ',
    rsquo: '’',
    lsquo: '‘',
    rdquo: '”',
    ldquo: '“',
    ndash: '–',
    mdash: '—',
    hellip: '…',
    eacute: 'é',
    Eacute: 'É',
  };

  return String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#x')) {
      const point = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    if (lower.startsWith('#')) {
      const point = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    return Object.hasOwn(named, lower) ? named[lower] : match;
  });
}

export async function getTriviaQuestions({ amount = 1, type = 'multiple' } = {}) {
  const safeAmount = Math.max(1, Math.min(10, Math.trunc(Number(amount) || 1)));
  const safeType = type === 'boolean' ? 'boolean' : 'multiple';

  try {
    const url = OPEN_TDB_URL + '?amount=' + safeAmount + '&type=' + safeType;
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error('Open Trivia DB returned HTTP ' + response.status);

    const payload = await response.json();
    if (payload.response_code !== 0 || !Array.isArray(payload.results) || payload.results.length === 0) {
      throw new Error('Open Trivia DB returned no questions.');
    }

    return payload.results.map((item) => ({
      category: decodeHtmlEntities(item.category || 'General Knowledge'),
      difficulty: String(item.difficulty || 'medium'),
      question: decodeHtmlEntities(item.question),
      correctAnswer: decodeHtmlEntities(item.correct_answer),
      incorrectAnswers: Array.isArray(item.incorrect_answers) ? item.incorrect_answers.map(decodeHtmlEntities) : [],
      source: 'Open Trivia DB',
    }));
  } catch {
    const fallback = safeType === 'boolean' ? BOOLEAN_FALLBACK : MULTIPLE_FALLBACK;
    return shuffleArray(fallback).slice(0, safeAmount).map((item) => ({
      ...item,
      incorrectAnswers: [...item.incorrectAnswers],
      source: 'SkyVerse offline',
    }));
  }
}

export function formatMultipleChoice(question) {
  const choices = shuffleArray([question.correctAnswer, ...(question.incorrectAnswers || [])]).slice(0, 4);
  const correctIndex = choices.findIndex((choice) => choice === question.correctAnswer);
  const correctLetter = 'ABCD'[correctIndex >= 0 ? correctIndex : 0];
  return {
    ...question,
    choices,
    correctLetter,
    optionsText: choices.map((choice, index) => String.fromCharCode(65 + index) + '. ' + choice).join('\n'),
  };
}

export async function getWordDefinition(word) {
  const normalized = String(word ?? '').trim().toLowerCase();
  if (!/^[a-z]{2,30}$/.test(normalized)) return null;

  try {
    const response = await fetch(WORD_API_BASE + '/define/' + encodeURIComponent(normalized), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;

    const payload = await response.json();
    const firstDefinition = Array.isArray(payload.definitions)
      ? payload.definitions.find((item) => item && typeof item.definition === 'string')
      : null;

    return {
      word: String(payload.word || normalized),
      found: Boolean(payload.found),
      definition: firstDefinition?.definition || null,
      source: 'WordSoHard',
    };
  } catch {
    return null;
  }
}

export async function getRandomWordData() {
  const word = shuffleArray(WORD_BANK)[0];
  const dictionary = await getWordDefinition(word);
  return {
    word,
    definition: dictionary?.found && dictionary.definition
      ? dictionary.definition
      : OFFLINE_DEFINITIONS[word] || 'A common English word.',
    source: dictionary?.found && dictionary.definition ? 'WordSoHard' : 'SkyVerse offline bank',
  };
}
