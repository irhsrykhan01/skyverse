const WIN_LINES = Object.freeze([[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,6],[2,5,8]]);
const games = new Map();
const playerGames = new Map();

function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(Boolean) ? 'draw' : null;
}

function snapshot(game) {
  return Object.freeze({ chatId: game.chatId, player1: game.player1, player2: game.player2, board: [...game.board], turn: game.turn, status: game.status, gameMessageId: game.gameMessageId, startedAt: game.startedAt });
}

function removeGame(game) {
  games.delete(game.chatId);
  playerGames.delete(game.player1);
  playerGames.delete(game.player2);
}

export function startTicTacToe(chatId, { player1, player2, gameMessageId = null } = {}) {
  if (!chatId || !player1 || !player2 || player1 === player2) return null;
  const old = games.get(chatId);
  if (old) removeGame(old);
  const game = { chatId, player1, player2, board: Array(9).fill(null), turn: player1, status: 'active', gameMessageId, startedAt: Date.now() };
  games.set(chatId, game);
  playerGames.set(player1, chatId);
  playerGames.set(player2, chatId);
  return snapshot(game);
}

export function getTicTacToe(chatId) {
  const game = games.get(chatId);
  return game ? snapshot(game) : null;
}

export function updateTicTacToeMessage(chatIdOrPlayer, gameMessageId) {
  const chatId = games.has(chatIdOrPlayer) ? chatIdOrPlayer : playerGames.get(chatIdOrPlayer);
  const game = chatId ? games.get(chatId) : null;
  if (game) game.gameMessageId = gameMessageId;
}

export function stopTicTacToe(chatId) {
  const game = games.get(chatId);
  if (game) removeGame(game);
}

export function isTicTacToeReply(chatIdOrPlayer, { chatId = null, stanzaId } = {}) {
  const resolvedChatId = chatId || (games.has(chatIdOrPlayer) ? chatIdOrPlayer : playerGames.get(chatIdOrPlayer));
  const game = resolvedChatId ? games.get(resolvedChatId) : null;
  return Boolean(game && game.status === 'active' && stanzaId && game.gameMessageId === stanzaId && (!chatId || game.chatId === chatId) && (game.player1 === chatIdOrPlayer || game.player2 === chatIdOrPlayer || games.has(chatIdOrPlayer)));
}

export function playerMark(game, jid) {
  if (jid === game.player1) return 'X';
  if (jid === game.player2) return 'O';
  return null;
}

function playGame(game, jid, position) {
  if (game.status !== 'active') return { ok: false, reason: 'not_started' };
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
    const output = { ok: true, result, winner: result === 'draw' ? null : (result === 'X' ? game.player1 : game.player2), playerMove: value, board: [...game.board], game: snapshot(game) };
    removeGame(game);
    return output;
  }
  game.turn = jid === game.player1 ? game.player2 : game.player1;
  return { ok: true, result: null, winner: null, playerMove: value, board: [...game.board], game: snapshot(game) };
}

export function playTicTacToe(chatIdOrPlayer, jidOrPosition, maybePosition) {
  const legacy = maybePosition === undefined;
  const chatId = legacy ? playerGames.get(chatIdOrPlayer) : chatIdOrPlayer;
  const jid = legacy ? chatIdOrPlayer : jidOrPosition;
  const position = legacy ? jidOrPosition : maybePosition;
  const game = chatId ? games.get(chatId) : null;
  return game ? playGame(game, jid, position) : { ok: false, reason: 'not_started' };
}

export function surrenderTicTacToe(chatId, jid) {
  const game = games.get(chatId);
  if (!game || game.status !== 'active') return { ok: false, reason: 'not_started' };
  if (!playerMark(game, jid)) return { ok: false, reason: 'not_player' };
  const winner = jid === game.player1 ? game.player2 : game.player1;
  game.status = 'surrendered';
  const output = { ok: true, result: 'surrender', surrenderer: jid, winner, board: [...game.board], game: snapshot(game) };
  removeGame(game);
  return output;
}

export function renderBoard(board) {
  const labels = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
  const cells = labels.map((label, i) => board[i] || label);
  return `${cells.slice(0, 3).join(' ')}\n${cells.slice(3, 6).join(' ')}\n${cells.slice(6, 9).join(' ')}`;
}
