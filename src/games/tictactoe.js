const WIN_LINES = Object.freeze([[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]);
const games = new Map();

function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(Boolean) ? 'draw' : null;
}

function snapshot(game) {
  return Object.freeze({
    chatId: game.chatId,
    player1: game.player1,
    player2: game.player2,
    board: [...game.board],
    turn: game.turn,
    status: game.status,
    gameMessageId: game.gameMessageId,
    startedAt: game.startedAt,
  });
}

export function startTicTacToe(chatId, { player1, player2, gameMessageId = null } = {}) {
  if (!chatId || !player1 || !player2 || player1 === player2) return null;
  const game = { chatId, player1, player2, board: Array(9).fill(null), turn: player1, status: 'active', gameMessageId, startedAt: Date.now() };
  games.set(chatId, game);
  return snapshot(game);
}

export function getTicTacToe(chatId) {
  const game = games.get(chatId);
  return game ? snapshot(game) : null;
}

export function updateTicTacToeMessage(chatId, gameMessageId) {
  const game = games.get(chatId);
  if (game) game.gameMessageId = gameMessageId;
}

export function stopTicTacToe(chatId) {
  games.delete(chatId);
}

export function isTicTacToeReply(chatId, { stanzaId } = {}) {
  const game = games.get(chatId);
  return Boolean(game && game.status === 'active' && stanzaId && game.gameMessageId === stanzaId);
}

export function playerMark(game, jid) {
  if (jid === game.player1) return 'X';
  if (jid === game.player2) return 'O';
  return null;
}

export function playTicTacToe(chatId, jid, position) {
  const game = games.get(chatId);
  if (!game || game.status !== 'active') return { ok: false, reason: 'not_started' };
  const mark = playerMark(game, jid);
  if (!mark) return { ok: false, reason: 'not_player' };
  if (game.turn !== jid) return { ok: false, reason: 'not_your_turn' };
  const value = Number(String(position).trim());
  if (!Number.isInteger(value) || value < 1 || value > 9) return { ok: false, reason: 'invalid' };
  const index = value - 1;
  if (game.board[index]) return { ok: false, reason: 'occupied' };

  game.board[index] = mark;
  const result = checkWinner(game.board);
  if (result) {
    game.status = result;
    games.delete(chatId);
    return { ok: true, result, winner: result === 'draw' ? null : (result === 'X' ? game.player1 : game.player2), playerMove: value, board: [...game.board], game: snapshot(game) };
  }

  game.turn = jid === game.player1 ? game.player2 : game.player1;
  return { ok: true, result: null, winner: null, playerMove: value, board: [...game.board], game: snapshot(game) };
}

export function surrenderTicTacToe(chatId, jid) {
  const game = games.get(chatId);
  if (!game || game.status !== 'active') return { ok: false, reason: 'not_started' };
  if (!playerMark(game, jid)) return { ok: false, reason: 'not_player' };
  const winner = jid === game.player1 ? game.player2 : game.player1;
  game.status = 'surrendered';
  games.delete(chatId);
  return { ok: true, result: 'surrender', surrenderer: jid, winner, board: [...game.board], game: snapshot(game) };
}

export function renderBoard(board) {
  const labels = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
  const cells = labels.map((label, i) => board[i] || label);
  return `${cells.slice(0, 3).join(' ')}\n${cells.slice(3, 6).join(' ')}\n${cells.slice(6, 9).join(' ')}`;
}
