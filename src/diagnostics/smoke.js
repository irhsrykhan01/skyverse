import { createCommandRegistry } from '../commands/registry.js';
import { loadConfig } from '../config/env.js';
import { createProviderManager } from '../services/providers/manager.js';
import * as media from '../services/media/index.js';
import { downloadResolvedMedia, resolveMediaTarget } from '../services/media/resolver.js';
import { startBombGame, getBombGame, guessBomb, stopBombGame } from '../games/bomb.js';
import { startMathQuiz, getMathQuiz, answerMathQuiz, stopMathQuiz, formatMathQuestion } from '../games/mathquiz.js';
import { startTicTacToe, getTicTacToe, playTicTacToe, surrenderTicTacToe } from '../games/tictactoe.js';
import { renderTicTacToe } from '../platform/whatsapp/tictactoe-canvas.js';
import { EconomyCore, economyDefaults } from '../economy/core.js';
import { normalizePhoneNumber } from '../security/identity.js';
import { createRichMessage, htmlToText } from '../platform/whatsapp/rich.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const config = loadConfig({});
const registry = await createCommandRegistry();
const providers = createProviderManager(config);
const visibleCommands = registry.all({ includeHidden: false });
const visibleNames = new Set(visibleCommands.map((command) => command.name));
for (const required of ['menu', 'help', 'ping', 'info', 'owner', 'balance', 'claim', 'sticker', 'brat', 'bratvid', 'iqc', 'smeme', 'stickerwatermark', 'tomp3', 'tomp4', 'toimg', 'tovideo', 'tovn', 'texttoqr', 'hd', 'removebg', 'warn', 'unwarn', 'delete', 'daily', 'pay', 'coinlog', 'coinlb']) assert(visibleNames.has(required), `Missing visible command: ${required}`);
for (const removed of ['tictactoe', 'a2uitest', 'add', 'warnings', 'ytmp4']) { assert(!visibleNames.has(removed), `Removed command is still visible: ${removed}`); assert(registry.resolve(removed) === undefined, `Removed command is still resolvable: ${removed}`); }
for (const command of visibleCommands) { assert(typeof command.execute === 'function', `Command ${command.name} has no execute().`); assert(['owner', 'admin', 'premium', 'npc'].includes(command.access), `Invalid access group: ${command.name}`); assert(Number.isInteger(command.cost) && command.cost >= 0, `Invalid coin cost: ${command.name}`); }
assert(registry.resolve('qc') === undefined, 'Disabled command qc is still resolvable.');
assert(registry.resolve('bratvid')?.name === 'bratvid', 'Rebuilt bratvid command is not enabled.');
assert(registry.resolve('fb')?.name === 'facebook', 'Facebook command alias regression.');
assert(registry.resolve('facebook')?.name === 'facebook', 'Facebook command name regression.');
assert(registry.resolve('tt')?.name === 'tiktok', 'TikTok command alias regression.');
assert(registry.resolve('tiktok')?.name === 'tiktok', 'TikTok command name regression.');
assert(registry.resolve('ig')?.name === 'instagram', 'Instagram command alias regression.');
assert(registry.resolve('instagram')?.name === 'instagram', 'Instagram command name regression.');
assert(registry.resolve('yt')?.name === 'youtube', 'YouTube command alias regression.');
assert(registry.resolve('youtube')?.name === 'youtube', 'YouTube command name regression.');
assert(typeof providers.makers?.brat === 'function', 'Maker provider is missing brat().');
assert(typeof providers.makers?.bratFrames === 'function', 'Maker provider is missing bratFrames().');
assert(typeof providers.makers?.iqc === 'function', 'Maker provider is missing iqc().');
assert(config.bratBaseUrl === 'https://aqul-brat.hf.space', 'Default Brat provider URL regression.');
assert(config.nexrayBaseUrl === 'https://api.nexray.web.id', 'Default Nexray provider URL regression.');
assert(typeof providers.downloader?.tiktok === 'function', 'Keyra TikTok provider is missing.');
assert(typeof providers.downloader?.youtube === 'function', 'Keyra YouTube provider is missing.');
assert(typeof providers.downloader?.youtubeMp3 === 'function', 'Keyra YouTube MP3 provider is missing.');
assert(typeof media.toMp3 === 'function', 'Media toMp3 export is missing.');
assert(typeof media.toMp4 === 'function', 'Media toMp4 export is missing.');
assert(normalizePhoneNumber('628123456789:7@s.whatsapp.net') === '628123456789', 'Phone normalization did not remove the WhatsApp device suffix.');
assert(typeof media.toVideo === 'function', 'Media toVideo export is missing.');
assert(typeof media.toVoiceNote === 'function', 'Media toVoiceNote export is missing.');
assert(typeof media.toHd === 'function', 'Media toHd export is missing.');
assert(typeof media.toSmeme === 'function', 'Media toSmeme export is missing.');
assert(typeof media.toStickerWatermark === 'function', 'Media toStickerWatermark export is missing.');
assert(typeof media.toAnimatedStickerFromFrames === 'function', 'Media frame animation export is missing.');
assert(typeof downloadResolvedMedia === 'function', 'Central media downloader export is missing.');
assert(typeof resolveMediaTarget === 'function', 'Media target resolver export is missing.');

const fakeUsers = new Map([
  ['smoke@lid', { jid: 'smoke@lid', number: '628000000000', push_name: 'Smoke User', coins: economyDefaults.newUserCoins, is_premium: 0, premium_until: null, last_claim_at: 0, daily_streak: 0, last_daily_at: 0, is_bot: 0 }],
  ['recipient@lid', { jid: 'recipient@lid', number: '628111111111', push_name: 'Recipient', coins: economyDefaults.newUserCoins, is_premium: 0, premium_until: null, last_claim_at: 0, daily_streak: 0, last_daily_at: 0, is_bot: 0 }],
]);
function fakeGetUser(jid) { return fakeUsers.get(jid); }
function fakeUpsertUser({ jid, number = null, pushName = null, isBot = false }) { if (!fakeUsers.has(jid)) { fakeUsers.set(jid, { jid, number, push_name: pushName, coins: economyDefaults.newUserCoins, is_premium: 0, premium_until: null, last_claim_at: 0, daily_streak: 0, last_daily_at: 0, is_bot: isBot ? 1 : 0 }); return { created: true, user: fakeGetUser(jid) }; } const user = fakeGetUser(jid); if (number) user.number = number; if (pushName) user.push_name = pushName; return { created: false, user }; }
const fakeRepositories = {
  users: { get: fakeGetUser, upsert: fakeUpsertUser },
  economy: {
    credit: ({ userJid, amount }) => { const user = fakeGetUser(userJid); const value = Math.floor(Number(amount)); if (!Number.isInteger(value) || value <= 0) return { ok: false, balance: user.coins, added: 0, reason: 'invalid_amount' }; user.coins += value; return { ok: true, balance: user.coins, added: value }; },
    debit: ({ userJid, amount }) => { const user = fakeGetUser(userJid); const value = Math.floor(Number(amount)); if (!Number.isInteger(value) || value <= 0) return { ok: false, balance: user.coins, spent: 0, required: value, reason: 'invalid_amount' }; if (user.coins < value) return { ok: false, balance: user.coins, spent: 0, required: value, reason: 'insufficient_funds' }; user.coins -= value; return { ok: true, balance: user.coins, spent: value, required: value }; },
    claim: ({ userJid, amount, now, cooldownMs }) => { const user = fakeGetUser(userJid); const remaining = Math.max(0, cooldownMs - (now - user.last_claim_at)); if (remaining > 0) return { ok: false, remaining, balance: user.coins }; user.coins += amount; user.last_claim_at = now; return { ok: true, amount, balance: user.coins, nextClaimAt: now + cooldownMs }; },
    daily: ({ userJid, now, cooldownMs, streakWindowMs, baseReward, streakBonus, maxReward }) => { const user = fakeGetUser(userJid); const remaining = Math.max(0, cooldownMs - (now - user.last_daily_at)); if (remaining > 0) return { ok: false, remaining, balance: user.coins, streak: user.daily_streak }; const streak = user.last_daily_at > 0 && now - user.last_daily_at <= streakWindowMs ? user.daily_streak + 1 : 1; const amount = Math.min(maxReward, baseReward + (streak - 1) * streakBonus); user.coins += amount; user.daily_streak = streak; user.last_daily_at = now; return { ok: true, amount, balance: user.coins, streak, nextDailyAt: now + cooldownMs }; },
    transferBetween: ({ fromUserJid, toUserJid, amount, fee = 0 }) => { const sender = fakeGetUser(fromUserJid); const recipient = fakeGetUser(toUserJid); if (sender.coins < amount + fee) return { ok: false, reason: 'insufficient_funds', balance: sender.coins, required: amount + fee }; sender.coins -= amount + fee; recipient.coins += amount; return { ok: true, amount, fee, senderBalance: sender.coins, recipientBalance: recipient.coins }; },
    history: () => [],
    leaderboard: (limit) => [...fakeUsers.values()].filter((user) => !user.is_bot).sort((a, b) => b.coins - a.coins).slice(0, limit).map((user) => ({ jid: user.jid, number: user.number, push_name: user.push_name, coins: user.coins })),
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
assert(Number.isInteger(bombSession?.bomb) && bombSession.bomb >= 1 && bombSession.bomb <= 9, 'Bomb game internal bomb contract failed.');
assert(guessBomb('smoke', 0).reason === 'invalid', 'Bomb game invalid-input contract failed.');
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
assert(getTicTacToe('smoke-ttt') === null, 'Tic-Tac-Toe cleanup contract failed.');

const rich = createRichMessage({ htmlPayload: '<h1>SkyVerse</h1><p>Hello <b>World</b></p>', actions: [{ text: 'Play', id: 'rich:play' }], trustedSources: ['https://github.com/irhsrykhan01/skyverse'] });
assert(rich.htmlPayload.includes('<h1>SkyVerse</h1>'), 'Rich htmlPayload contract failed.');
assert(rich.text.includes('SkyVerse') && rich.text.includes('Hello World'), 'Rich HTML-to-text contract failed.');
assert(rich.actions[0]?.id === 'rich:play', 'Rich action contract failed.');
assert(htmlToText('<p>A</p><p>B</p>') === 'A\nB', 'Rich HTML formatter regression failed.');

const syntheticPtv = { key: { remoteJid: '120000000000000@g.us', id: 'PTV-SMOKE', fromMe: false }, message: { extendedTextMessage: { contextInfo: { stanzaId: 'PTV-QUOTED', participant: '116000000000000@lid', quotedMessage: { ptvMessage: { url: 'https://example.invalid/ptv.mp4', mimetype: 'video/mp4', fileLength: 12345 } } } } } };
const ptvDescriptor = resolveMediaTarget(syntheticPtv);
assert(ptvDescriptor?.type === 'video', 'PTV regression: ptvMessage was not classified as video.');
assert(ptvDescriptor?.isPTV === true, 'PTV regression: isPTV flag was not preserved.');
assert(ptvDescriptor?.message?.message?.videoMessage, 'PTV regression: ptvMessage was not normalized for downloadMediaMessage.');

console.log(`SkyVerse smoke test passed: ${visibleCommands.length} visible commands + maker providers + downloader aliases + economy + games + Canvas Rich + PTV resolver tests.`);
