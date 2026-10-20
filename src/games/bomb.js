const GRID_SIZE = 9;

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const sessions = new Map();

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cell(index, opened) {
  return opened.has(index) ? '✅' : `${index}\uFE0F\u20E3`;
}

function makeBoard(opened = new Set()) {
  const cells = Array.from({ length: GRID_SIZE }, (_, i) => cell(i + 1, opened));
  const rows = [];

  for (let i = 0; i < cells.length; i += 3) {
    rows.push(cells.slice(i, i + 3).join(' '));
  }

  return rows.join('\n');
}

function publicSession(session) {
  return {
    userId: session.userId,
    chatId: session.chatId,
    gameMessageId: session.gameMessageId,
    opened: new Set(session.opened),
    startedAt: session.startedAt,
    lastActionAt: session.lastActionAt,
    board: makeBoard(session.opened),
    bomb: undefined,
  };
}

export function startBombGame(userId, { chatId = null, gameMessageId = null, now = Date.now() } = {}) {
  const session = {
    userId,
    chatId,
    gameMessageId,
    bomb: randomInt(1, GRID_SIZE),
    opened: new Set(),
    startedAt: now,
    lastActionAt: now,
  };

  sessions.set(userId, session);
  return publicSession(session);
}

export function getBombGame(userId) {
  const session = sessions.get(userId);
  if (!session) return null;

  if (Date.now() - session.lastActionAt > SESSION_TIMEOUT_MS) {
    sessions.delete(userId);
    return null;
  }

  return publicSession(session);
}

export function updateBombMessage(userId, gameMessageId) {
  const session = sessions.get(userId);
  if (session) session.gameMessageId = gameMessageId;
}

export function stopBombGame(userId) {
  sessions.delete(userId);
}

export function isBombReply(userId, { chatId, stanzaId } = {}) {
  const session = sessions.get(userId);
  if (!session || !stanzaId) return false;

  if (Date.now() - session.lastActionAt > SESSION_TIMEOUT_MS) {
    sessions.delete(userId);
    return false;
  }

  return session.chatId === chatId && session.gameMessageId === stanzaId;
}

export function guessBomb(userId, guess, { now = Date.now() } = {}) {
  const session = sessions.get(userId);
  if (!session) return { ok: false, reason: 'not_started' };

  if (now - session.lastActionAt > SESSION_TIMEOUT_MS) {
    sessions.delete(userId);
    return { ok: false, reason: 'expired' };
  }

  const value = Number(String(guess).trim());
  if (!Number.isInteger(value) || value < 1 || value > GRID_SIZE) {
    return { ok: false, reason: 'invalid' };
  }

  if (session.opened.has(value)) {
    return { ok: false, reason: 'already_opened', value };
  }

  session.lastActionAt = now;

  if (value === session.bomb) {
    sessions.delete(userId);

    return {
      ok: true,
      result: 'lose',
      selected: value,
    };
  }

  session.opened.add(value);
  return {
    ok: true,
    result: 'safe',
    selected: value,
    opened: [...session.opened],
    remaining: GRID_SIZE - 1 - session.opened.size,
    board: makeBoard(session.opened),
  };
}

export function formatBombBoard(userId) {
  const session = sessions.get(userId);
  return session ? makeBoard(session.opened) : null;
}
