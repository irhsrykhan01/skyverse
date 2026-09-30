import { createProviderManager } from '../services/providers/manager.js';
import * as media from '../services/media/index.js';
import { downloadResolvedMedia, resolveMediaTarget } from '../services/media/resolver.js';
import { startBombGame, getBombGame, guessBomb, stopBombGame } from '../games/bomb.js';
import { startMathQuiz, getMathQuiz, answerMathQuiz, stopMathQuiz, formatMathQuestion } from '../games/mathquiz.js';
import { startTicTacToe, getTicTacToe, playTicTacToe, surrenderTicTacToe } from '../games/tictactoe.js';
import { renderTicTacToe } from '../platform/whatsapp/tictactoe-canvas.js';
import { EconomyCore, economyDefaults } from '../economy/core.js';
import { assert } from './smoke-assert.js';

const fakeUsers = new Map([
  ['smoke@lid', {
    jid: 'smoke@lid', number: '628000000000', push_name: 'Smoke User',
    coins: economyDefaults.newUserCoins, is_premium: 0, premium_until: null,
    last_claim_at: 0, daily_streak: 0, last_daily_at: 0, is_bot: 0,
  }],
  ['recipient@lid', {
    jid: 'recipient@lid', number: '628111111111', push_name: 'Recipient',
    coins: economyDefaults.newUserCoins, is_premium: 0, premium_until: null,
    last_claim_at: 0, daily_streak: 0, last_daily_at: 0, is_bot: 0,
  }],
]);

function fakeGetUser(jid) { return fakeUsers.get(jid); }
function fakeUpsertUser({ jid, number = null, pushName = null, isBot = false }) {
  if (!fakeUsers.has(jid)) {
    fakeUsers.set(jid, {
      jid, number, push_name: pushName, coins: economyDefaults.newUserCoins,
      is_premium: 0, premium_until: null, last_claim_at: 0,
      daily_streak: 0, last_daily_at: 0, is_bot: isBot ? 1 : 0,
    });
    return { created: true, user: fakeGetUser(jid) };
  }
  const user = fakeGetUser(jid);
  if (number) user.number = number;
  if (pushName) user.push_name = pushName;
  return { created: false, user };
}

const fakeRepositories = {
  users: { get: fakeGetUser, upsert: fakeUpsertUser },
  economy: {
    credit: ({ userJid, amount }) => {
      const user = fakeGetUser(userJid); const value = Math.floor(Number(amount));
      if (!Number.isInteger(value) || value <= 0) return { ok: false, balance: user.coins, added: 0, reason: 'invalid_amount' };
      user.coins += value; return { ok: true, balance: user.coins, added: value };
    },
    debit: ({ userJid, amount }) => {
      const user = fakeGetUser(userJid); const value = Math.floor(Number(amount));
      if (!Number.isInteger(value) || value <= 0) return { ok: false, balance: user.coins, spent: 0, required: value, reason: 'invalid_amount' };
      if (user.coins < value) return { ok: false, balance: user.coins, spent: 0, required: value, reason: 'insufficient_funds' };
      user.coins -= value; return { ok: true, balance: user.coins, spent: value, required: value };
    },
    claim: ({ userJid, amount, now, cooldownMs }) => {
      const user = fakeGetUser(userJid); const remaining = Math.max(0, cooldownMs - (now - user.last_claim_at));
      if (remaining > 0) return { ok: false, remaining, balance: user.coins };
      user.coins += amount; user.last_claim_at = now;
      return { ok: true, amount, balance: user.coins, nextClaimAt: now + cooldownMs };
    },
    daily: ({ userJid, now, cooldownMs, streakWindowMs, baseReward, streakBonus, maxReward }) => {
      const user = fakeGetUser(userJid); const remaining = Math.max(0, cooldownMs - (now - user.last_daily_at));
      if (remaining > 0) return { ok: false, remaining, balance: user.coins, streak: user.daily_streak };
      const streak = user.last_daily_at > 0 && now - user.last_daily_at <= streakWindowMs ? user.daily_streak + 1 : 1;
      const amount = Math.min(maxReward, baseReward + (streak - 1) * streakBonus);
      user.coins += amount; user.daily_streak = streak; user.last_daily_at = now;
      return { ok: true, amount, balance: user.coins, streak, nextDailyAt: now + cooldownMs };
    },
    transferBetween: ({ fromUserJid, toUserJid, amount, fee = 0 }) => {
      const sender = fakeGetUser(fromUserJid); const recipient = fakeGetUser(toUserJid);
      if (sender.coins < amount + fee) return { ok: false, reason: 'insufficient_funds', balance: sender.coins, required: amount + fee };
      sender.coins -= amount + fee; recipient.coins += amount;
      return { ok: true, amount, fee, senderBalance: sender.coins, recipientBalance: recipient.coins };
    },
    history: () => [],
    leaderboard: (limit) => [...fakeUsers.values()].filter((user) => !user.is_bot)
      .sort((a, b) => b.coins - a.coins).slice(0, limit)
      .map((user) => ({ jid: user.jid, number: user.number, push_name: user.push_name, coins: user.coins })),
  },
};

const economy = new EconomyCore({ repositories: fakeRepositories });
assert(economy.getCoins('smoke@lid') === 100, 'Economy default wallet is not 100 coins.');
const spent = economy.spendCoins('smoke@lid', 10, 'smoke');
assert(spent.ok && spent.balance === 90, 'Economy debit contract failed.');
const credited = economy.addCoins('smoke@lid', 10, 'smoke');
assert(credited === 100, 'Economy credit compatibility contract failed.');
const claim = economy.claim('smoke@lid', Date.now());
assert(claim.ok && claim.amount >= 2 && claim.amount <= 7, 'Economy periodic claim contract failed.');
const dailyNow = Date.now() + economyDefaults.claimCooldownMs + 1;
const daily = economy.daily('smoke@lid', dailyNow);
assert(daily.ok && daily.amount === 50 && daily.streak === 1, 'Economy daily reward contract failed.');
const dailyAgain = economy.daily('smoke@lid', dailyNow + 1);
assert(!dailyAgain.ok, 'Economy daily cooldown contract failed.');
const transfer = economy.transfer('smoke@lid', 'recipient@lid', 20, 'smoke:transfer');
assert(transfer.ok && transfer.amount === 20, 'Economy transfer contract failed.');
assert(economy.getCoins('smoke@lid') === transfer.senderBalance, 'Economy sender balance mismatch after transfer.');
assert(economy.getCoins('recipient@lid') === transfer.recipientBalance, 'Economy recipient balance mismatch after transfer.');
const coinLeaderboard = economy.leaderboard(2);
assert(coinLeaderboard.length === 2 && coinLeaderboard[0].coins >= coinLeaderboard[1].coins, 'Economy leaderboard contract failed.');

const bombSession = startBombGame('smoke');
const visibleBomb = getBombGame('smoke');
assert(visibleBomb?.userId === 'smoke', 'Bomb game session contract failed.');
assert(visibleBomb?.gameMessageId === null, 'Bomb game message-id contract failed.');
assert(visibleBomb?.bomb === undefined, 'Bomb location leaked from public session contract.');
assert(visibleBomb?.opened instanceof Set, 'Bomb game opened-state contract failed.');
assert(Number.isInteger(bombSession?.bomb) === false, 'Bomb game start API must not expose the internal bomb.');
assert(guessBomb('smoke', 0).reason === 'invalid', 'Bomb game invalid-input contract failed.');
const bombGuess = guessBomb('smoke', 1);
assert(bombGuess.ok && ['safe', 'lose'].includes(bombGuess.result), 'Bomb game valid-guess contract failed.');
stopBombGame('smoke');

const mathSession = startMathQuiz('smoke');
assert(getMathQuiz('smoke')?.answer === mathSession.answer, 'Math quiz session contract failed.');
assert(formatMathQuestion(mathSession).includes('='), 'Math quiz formatter contract failed.');
assert(answerMathQuiz('smoke', mathSession.answer).result === 'win', 'Math quiz answer contract failed.');
stopMathQuiz('smoke');

const p1 = '111111111111111@s.whatsapp.net';
const p2 = '222222222222222@s.whatsapp.net';
const ttt = startTicTacToe('smoke-ttt', { player1: p1, player2: p2, gameMessageId: 'TTT-MSG' });
assert(ttt?.turn === p1 && ttt.board.length === 9, 'Tic-Tac-Toe session contract failed.');
assert(playTicTacToe('smoke-ttt', p1, 1).ok, 'Tic-Tac-Toe first move contract failed.');
assert(playTicTacToe('smoke-ttt', p1, 2).reason === 'not_your_turn', 'Tic-Tac-Toe turn contract failed.');
assert(playTicTacToe('smoke-ttt', p2, 5).ok, 'Tic-Tac-Toe second move contract failed.');
assert(renderTicTacToe(['X', null, null, null, 'O', null, null, null, null]).length > 100, 'Tic-Tac-Toe Canvas render contract failed.');
assert(surrenderTicTacToe('smoke-ttt', p1).result === 'surrender', 'Tic-Tac-Toe surrender contract failed.');

console.log('Smoke tests passed.');
