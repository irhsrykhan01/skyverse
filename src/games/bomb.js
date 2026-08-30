const GRID_SIZE = 9;
const WIN_REWARDS = Object.freeze([
  { value: 3, weight: 28 }, { value: 4, weight: 24 }, { value: 5, weight: 18 },
  { value: 6, weight: 12 }, { value: 7, weight: 8 }, { value: 8, weight: 6 },
  { value: 9, weight: 3 }, { value: 10, weight: 1 },
]);
const LOSE_PENALTIES = Object.freeze([
  { value: 3, weight: 40 }, { value: 4, weight: 24 }, { value: 5, weight: 16 },
  { value: 6, weight: 10 }, { value: 7, weight: 6 }, { value: 8, weight: 3 }, { value: 9, weight: 1 },
]);
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const sessions = new Map();

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function weightedRandom(table) {
  const total = table.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const item of table) { cursor -= item.weight; if (cursor < 0) return item.value; }
  return table[table.length - 1].value;
}
function cell(index, opened) { return opened.has(index) ? '✅' : `${index}\uFE0F\u20E3`; }
function makeBoard(opened = new Set()) {
  return [1,2,3,4,5,6,7,8,9].map((n) => cell(n, opened)).reduce((rows, n, i) => {
    const row = Math.floor(i / 3); (rows[row] ??= []).push(n); return rows;
  }, []).map((row) => row.join(' ')).join('
');
}

export function startBombGame(userId, { chatId = null, gameMessageId = null, now = Date.now() } = {}) {
  const session = { userId, chatId, gameMessageId, bomb: randomInt(1, GRID_SIZE), opened: new Set(), startedAt: now, lastActionAt: now };
  sessions.set(userId, session);
  return { ...session, opened: new Set(session.opened), board: makeBoard(session.opened), bomb: undefined };
}
export function getBombGame(userId) {
  const session = sessions.get(userId);
  if (!session) return null;
  if (Date.now() - session.lastActionAt > SESSION_TIMEOUT_MS) { sessions.delete(userId); return null; }
  return { ...session, opened: new Set(session.opened), board: makeBoard(session.opened), bomb: undefined };
}
export function updateBombMessage(userId, gameMessageId) { const session = sessions.get(userId); if (session) session.gameMessageId = gameMessageId; }
export function stopBombGame(userId) { sessions.delete(userId); }
export function isBombReply(userId, { chatId, stanzaId } = {}) {
  const session = sessions.get(userId);
  if (!session || !stanzaId) return false;
  if (Date.now() - session.lastActionAt > SESSION_TIMEOUT_MS) { sessions.delete(userId); return false; }
  return session.chatId === chatId && session.gameMessageId === stanzaId;
}
export function guessBomb(userId, guess, { now = Date.now() } = {}) {
  const session = sessions.get(userId);
  if (!session) return { ok: false, reason: 'not_started' };
  if (now - session.lastActionAt > SESSION_TIMEOUT_MS) { sessions.delete(userId); return { ok: false, reason: 'expired' }; }
  const value = Number(String(guess).trim());
  if (!Number.isInteger(value) || value < 1 || value > GRID_SIZE) return { ok: false, reason: 'invalid' };
  if (session.opened.has(value)) return { ok: false, reason: 'already_opened', value };
  session.lastActionAt = now;
  if (value === session.bomb) {
    const penalty = weightedRandom(LOSE_PENALTIES); const bomb = session.bomb; sessions.delete(userId);
    return { ok: true, result: 'lose', bomb, selected: value, penalty };
  }
  session.opened.add(value);
  const reward = weightedRandom(WIN_REWARDS);
  return { ok: true, result: 'safe', selected: value, reward, opened: [...session.opened], remaining: GRID_SIZE - 1 - session.opened.size, board: makeBoard(session.opened) };
}
export function formatBombBoard(userId) { const session = sessions.get(userId); return session ? makeBoard(session.opened) : null; }
