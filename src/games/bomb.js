const MIN_NUMBER = 1;
const MAX_NUMBER = 20;
const MAX_ATTEMPTS = 5;
const WIN_REWARD = [2, 5];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const sessions = new Map();

export function startBombGame(userId) {
  const bomb = randomInt(MIN_NUMBER, MAX_NUMBER);
  const session = { bomb, attempts: 0, maxAttempts: MAX_ATTEMPTS, startedAt: Date.now() };
  sessions.set(userId, session);
  return session;
}

export function getBombGame(userId) {
  return sessions.get(userId) ?? null;
}

export function stopBombGame(userId) {
  sessions.delete(userId);
}

export function guessBomb(userId, guess) {
  const session = sessions.get(userId);
  if (!session) return { ok: false, reason: 'not_started' };
  const value = Number(guess);
  if (!Number.isInteger(value) || value < MIN_NUMBER || value > MAX_NUMBER) {
    return { ok: false, reason: 'invalid', min: MIN_NUMBER, max: MAX_NUMBER };
  }
  session.attempts += 1;
  if (value === session.bomb) {
    stopBombGame(userId);
    return { ok: true, result: 'win', attempts: session.attempts, reward: randomInt(WIN_REWARD[0], WIN_REWARD[1]) };
  }
  if (session.attempts >= session.maxAttempts) {
    const bomb = session.bomb;
    stopBombGame(userId);
    return { ok: true, result: 'lose', attempts: session.attempts, bomb };
  }
  return {
    ok: true,
    result: value < session.bomb ? 'higher' : 'lower',
    attempts: session.attempts,
    remaining: session.maxAttempts - session.attempts,
  };
}
