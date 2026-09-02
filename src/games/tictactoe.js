const WIN_LINES = Object.freeze([[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]);
const sessions = new Map();
function winner(board) { for (const [a,b,c] of WIN_LINES) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]; return board.every(Boolean) ? 'draw' : null; }
function freeCells(board) { return board.map((v,i) => v ? -1 : i).filter((i) => i >= 0); }
function computerMove(board) {
  const free = freeCells(board); if (!free.length) return null;
  for (const i of free) { board[i]='⭕'; if (winner(board)==='⭕') return i; board[i]=null; }
  for (const i of free) { board[i]='❌'; if (winner(board)==='❌') { board[i]='⭕'; return i; } board[i]=null; }
  if (board[4]===null) { board[4]='⭕'; return 4; }
  const corners=[0,2,6,8].filter((i)=>board[i]===null); const pool=corners.length?corners:free; const i=pool[Math.floor(Math.random()*pool.length)]; board[i]='⭕'; return i;
}
function renderBoard(board) {
  const labels=['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
  const cells=labels.map((label,i)=>board[i] || label);
  return cells.slice(0,3).join(' ')+'\n'+cells.slice(3,6).join(' ')+'\n'+cells.slice(6,9).join(' ');
}
export function startTicTacToe(userId,{chatId=null,gameMessageId=null}={}) { const state={userId,chatId,gameMessageId,board:Array(9).fill(null),turn:'❌',startedAt:Date.now()}; sessions.set(userId,state); return snapshot(state); }
export function getTicTacToe(userId) { const state=sessions.get(userId); return state ? snapshot(state) : null; }
export function updateTicTacToeMessage(userId,gameMessageId) { const state=sessions.get(userId); if(state) state.gameMessageId=gameMessageId; }
export function stopTicTacToe(userId) { sessions.delete(userId); }
export function isTicTacToeReply(userId,{chatId,stanzaId}={}) { const state=sessions.get(userId); return Boolean(state && state.chatId===chatId && state.gameMessageId===stanzaId); }
export function playTicTacToe(userId,position) {
  const state=sessions.get(userId); if(!state) return {ok:false,reason:'not_started'}; if(state.turn!=='❌') return {ok:false,reason:'not_your_turn'};
  const value=Number(position); if(!Number.isInteger(value)||value<1||value>9) return {ok:false,reason:'invalid'};
  const index=value-1; if(state.board[index]) return {ok:false,reason:'occupied'}; state.board[index]='❌';
  let result=winner(state.board); if(result){sessions.delete(userId);return {ok:true,result,playerMove:value,board:renderBoard(state.board)};}
  state.turn='⭕'; const aiMove=computerMove(state.board); result=winner(state.board); if(result){sessions.delete(userId);return {ok:true,result,playerMove:value,aiMove:aiMove===null?null:aiMove+1,board:renderBoard(state.board)};}
  state.turn='❌'; return {ok:true,result:null,playerMove:value,aiMove:aiMove===null?null:aiMove+1,board:renderBoard(state.board)};
}
function snapshot(state){return Object.freeze({userId:state.userId,chatId:state.chatId,gameMessageId:state.gameMessageId,board:[...state.board],turn:state.turn,startedAt:state.startedAt,renderedBoard:renderBoard(state.board)});}