const MIN_A = 2;
const MAX_A = 50;
const MIN_B = 2;
const MAX_B = 20;
const WIN_REWARD = [2, 6];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createQuestion() {
  const a = randomInt(MIN_A, MAX_A);
  const b = randomInt(MIN_B, MAX_B);
  const operators = ['+', '-', '*'];
  const operator = operators[randomInt(0, operators.length - 1)];
  const answer = operator === '+' ? a + b : operator === '-' ? a - b : a * b;
  return { a, b, operator, answer };
}

const sessions = new Map();

export function startMathQuiz(userId) {
  const question = createQuestion();
  const session = { ...question, startedAt: Date.now() };
  sessions.set(userId, session);
  return session;
}

export function getMathQuiz(userId) {
  return sessions.get(userId) ?? null;
}

export function stopMathQuiz(userId) {
  sessions.delete(userId);
}

export function answerMathQuiz(userId, answer) {
  const session = sessions.get(userId);
  if (!session) return { ok: false, reason: 'not_started' };
  const value = Number(answer);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return { ok: false, reason: 'invalid' };
  stopMathQuiz(userId);
  if (value === session.answer) {
    return { ok: true, result: 'win', reward: randomInt(WIN_REWARD[0], WIN_REWARD[1]), answer: session.answer };
  }
  return { ok: true, result: 'lose', answer: session.answer };
}

export function formatMathQuestion(session) {
  return `${session.a} ${session.operator} ${session.b} = ?`;
}
