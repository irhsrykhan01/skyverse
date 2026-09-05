import { createCanvas } from 'canvas';

const WIDTH = 500;
const HEIGHT = 550;
const BOARD_SIZE = 390;
const START_X = 55;
const START_Y = 105;
const CELL = BOARD_SIZE / 3;

function safeText(value, fallback = '') {
  return String(value ?? fallback).slice(0, 120);
}

export function renderTicTacToe(board, { turnName = '', statusText = '' } = {}) {
  if (!Array.isArray(board) || board.length !== 9) throw new TypeError('Tic-Tac-Toe board must contain 9 cells.');
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#171923';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#f5f7ff';
  ctx.font = 'bold 24px Sans';
  ctx.textAlign = 'center';
  ctx.fillText(safeText(statusText || `Giliran: ${turnName}`), WIDTH / 2, 48);

  ctx.strokeStyle = '#7aa2f7';
  ctx.lineWidth = 6;
  for (let i = 1; i < 3; i += 1) {
    const offset = START_X + i * CELL;
    ctx.beginPath(); ctx.moveTo(offset, START_Y); ctx.lineTo(offset, START_Y + BOARD_SIZE); ctx.stroke();
    const y = START_Y + i * CELL;
    ctx.beginPath(); ctx.moveTo(START_X, y); ctx.lineTo(START_X + BOARD_SIZE, y); ctx.stroke();
  }

  for (let i = 0; i < 9; i += 1) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = START_X + col * CELL + CELL / 2;
    const y = START_Y + row * CELL + CELL / 2;
    const mark = board[i];

    if (mark === 'X' || mark === '❌') {
      ctx.strokeStyle = '#ff6b9a';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 42, y - 42); ctx.lineTo(x + 42, y + 42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 42, y - 42); ctx.lineTo(x - 42, y + 42); ctx.stroke();
    } else if (mark === 'O' || mark === '⭕') {
      ctx.strokeStyle = '#7ee787';
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(x, y, 44, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = '#6f7387';
      ctx.font = 'bold 30px Sans';
      ctx.fillText(String(i + 1), x, y + 10);
    }
  }

  ctx.fillStyle = '#aeb4c7';
  ctx.font = '18px Sans';
  ctx.fillText('SkyVerse • Tic-Tac-Toe', WIDTH / 2, 535);
  return canvas.toBuffer('image/png');
}
