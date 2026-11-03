import { createCommandRegistry } from '../commands/registry.js';
import { loadConfig } from '../config/env.js';
import { createProviderManager } from '../services/providers/manager.js';
import * as media from '../services/media/index.js';
import { downloadResolvedMedia, resolveMediaTarget } from '../services/media/resolver.js';
import { startBombGame, getBombGame, guessBomb, stopBombGame } from '../games/bomb.js';
import { startMathQuiz, getMathQuiz, answerMathQuiz, stopMathQuiz, formatMathQuestion } from '../games/mathquiz.js';
import { startMiniGame, getMiniGame, isMiniGameReply, answerMiniGame, updateMiniGameMessage, stopMiniGame } from '../games/mini-games.js';
import { formatMultipleChoice } from '../services/games-api.js';
import { startTicTacToe, getTicTacToe, playTicTacToe, surrenderTicTacToe } from '../games/tictactoe.js';
import { renderTicTacToe } from '../platform/whatsapp/tictactoe-canvas.js';
import { normalizePhoneNumber } from '../security/identity.js';
import { createRichMessage, htmlToText } from '../platform/whatsapp/rich.js';
import { disconnectStatus, isInvalidSessionDisconnect, recoveryDelay, recoveryReason } from '../platform/whatsapp/recovery.js';
import { renderMockUi } from '../services/mock-ui.js';
import { MENU_CATEGORY_DEFINITIONS, resolveMenuCategory } from '../core/menu-categories.js';
import { command as allmenuCommand } from '../commands/general/allmenu.js';
import { sendWithFallback, sendVideoAsMp3 } from '../commands/downloader/_generic.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, createRepositories } from '../database/index.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const config = loadConfig({});
const registry = await createCommandRegistry();
const providers = createProviderManager(config);
assert(config.depayBaseUrl === undefined, 'Removed Depay configuration is still present.');
assert(providers.depay === undefined, 'Removed Depay provider is still exposed.');
assert(providers.siputzx && typeof providers.siputzx.youtube === 'function', 'Legacy Siputzx provider should remain isolated from the main downloader.');
assert(providers.ytdlp && typeof providers.ytdlp.youtube === 'function' && typeof providers.ytdlp.instagram === 'function', 'Local yt-dlp provider is missing.');
assert(config.ytDlpPath === 'yt-dlp', 'Default yt-dlp executable path is incorrect.');
assert(typeof sendVideoAsMp3 === 'function', 'Local video-to-MP3 conversion helper is missing.');
assert(resolveMenuCategory('economy') === null, 'Removed economy menu category is still registered.');
assert(resolveMenuCategory('media') === 'media', 'Media menu category is missing.');
const visibleCommands = registry.all({ includeHidden: false });
const visibleNames = new Set(visibleCommands.map((command) => command.name));
const registeredCategories = registry.byCategory({ includeHidden: false });
const definedCategories = new Set(MENU_CATEGORY_DEFINITIONS.map(({ key }) => key));
assert(!registeredCategories.has('economy'), 'Removed economy menu category is still registered in command registry.');
for (const category of registeredCategories.keys()) {
  assert(definedCategories.has(category), `Command category is missing from menu definitions: ${category}`);
}

const allmenuPayloads = [];
await allmenuCommand.execute({
  registry,
  config: { prefix: '.' },
  senderJid: '1234567890@s.whatsapp.net',
  user: { is_premium: false },
  chatId: '1234567890@s.whatsapp.net',
  socket: {
    sendMessage: async (_jid, payload) => {
      allmenuPayloads.push(payload);
      return { key: { id: `SMOKE-ALLMENU-${allmenuPayloads.length}` } };
    },
  },
});
const allmenuTextPayload = allmenuPayloads.find((payload) => typeof payload.text === 'string');
assert(typeof allmenuTextPayload?.text === 'string' && allmenuTextPayload.text.includes('Dukung SkyVerse:'), 'Allmenu plain-text delivery contract failed.');
const allmenuAdReply = allmenuTextPayload?.contextInfo?.externalAdReply;
assert(allmenuAdReply?.title === 'SkyVerse', 'Allmenu externalAdReply title contract failed.');
assert(allmenuAdReply?.body === 'All-in-one WhatsApp virtual bot assistant.', 'Allmenu externalAdReply body contract failed.');
assert(allmenuAdReply?.mediaType === 1, 'Allmenu externalAdReply mediaType contract failed.');
assert(Buffer.isBuffer(allmenuAdReply?.thumbnail) && allmenuAdReply.thumbnail.length > 0, 'Allmenu externalAdReply thumbnail contract failed.');
assert(allmenuAdReply?.sourceUrl === 'https://saweria.co/irhsrykhn', 'Allmenu externalAdReply sourceUrl contract failed.');
assert(allmenuAdReply?.renderLargerThumbnail === true, 'Allmenu externalAdReply renderLargerThumbnail contract failed.');
for (const required of ['menu', 'allmenu', 'helper', 'help', 'ping', 'info', 'owner', 'coin', 'limit', 'daily', 'limitshop', 'economystats', 'sticker', 'brat', 'bratvid', 'brathd', 'iqc', 'smeme', 'stickerwatermark', 'tomp3', 'tomp4', 'toimg', 'tovideo', 'tovn', 'texttoqr', 'hd', 'removebg', 'warn', 'unwarn', 'delete', 'pinterest', 'twitter', 'mediafire', 'gdrive', 'ttmp3', 'ytmp3', 'igmp3', 'fakecall', 'fakewagroup', 'fakewachannel', 'fakettprofile', 'fakettcomment', 'fakefbcomment', 'mockwallet', 'trivia', 'benarsalah', 'quizcepat', 'susunkata', 'tebakkata', 'tebakangka', 'tebakemoji', 'rps']) assert(visibleNames.has(required), `Missing visible command: ${required}`);
for (const removed of ['tictactoe', 'a2uitest', 'add', 'warnings', 'ytmp4']) { assert(!visibleNames.has(removed), `Removed command is still visible: ${removed}`); assert(registry.resolve(removed) === undefined, `Removed command is still resolvable: ${removed}`); }
for (const command of visibleCommands) { assert(typeof command.execute === 'function', `Command ${command.name} has no execute().`); assert(['owner', 'admin', 'premium', 'npc'].includes(command.access), `Invalid access group: ${command.name}`); }
assert(registry.resolve('qc') === undefined, 'Disabled command qc is still resolvable.');
assert(registry.resolve('coin')?.name === 'coin', 'Coin balance command is missing.');
assert(registry.resolve('bal')?.name === 'coin', 'Coin command alias is missing.');
assert(registry.resolve('balance') === undefined, 'Deprecated balance command should not be resolvable.');
assert(registry.resolve('limit')?.name === 'limit', 'Limit balance command is missing.');
assert(registry.resolve('daily')?.name === 'daily', 'Daily reward command is missing.');
assert(registry.resolve('harian')?.name === 'daily', 'Daily command alias is missing.');
assert(registry.resolve('limitshop')?.name === 'limitshop', 'Limit Shop command is missing.');
assert(registry.resolve('economystats')?.name === 'economystats', 'Economy stats command is missing.');
for (const name of ['coin', 'limit', 'daily', 'limitshop', 'economystats']) {
  assert(registry.resolve(name)?.category === 'general', `Economy command ${name} must appear under General.`);
}
for (const name of ['brat', 'bratvid', 'iqc', 'sticker', 'stickerwatermark']) {
  assert(registry.resolve(name)?.limitCost === 1, `Paid feature ${name} must cost exactly one Limit.`);
}
assert((registry.resolve('ping')?.limitCost ?? 0) === 0, 'Free commands must not consume Limit.');
assert(registry.resolve('bratvid')?.name === 'bratvid', 'Rebuilt bratvid command is not enabled.');
assert(registry.resolve('allmenu')?.permission === 'user' && !registry.resolve('allmenu')?.hidden, 'Allmenu must be visible to regular users.');
assert(registry.resolve('helper')?.permission === 'user', 'Helper must be available to regular users.');
for (const name of ['toimg', 'tomp3', 'tomp4', 'tovideo']) {
  assert(registry.resolve(name)?.category === 'media', name + ' must belong to the Media category.');
}
assert(registry.resolve('brathd')?.limitCost === 1, 'BratHD must consume one Limit.');

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
assert(config.delineBaseUrl === 'https://api.deline.web.id', 'Default Deline URL regression.');
assert(config.zenzxzBaseUrl === 'https://api.zenzxz.my.id', 'Default Zenzxz URL regression.');
assert(config.vredenBaseUrl === 'https://api.vreden.my.id', 'Default Vreden URL regression.');
assert(config.tikwmBaseUrl === 'https://www.tikwm.com/api/', 'Default TikWM URL regression.');
assert(config.reelsVideoBaseUrl === 'https://reelsvideo.io', 'Default ReelsVideo URL regression.');
assert(typeof providers.downloader?.tiktok === 'function', 'TikWM downloader is missing.');
assert(typeof providers.downloader?.instagram === 'function', 'yt-dlp Instagram downloader is missing.');
assert(typeof providers.downloader?.youtube === 'function', 'yt-dlp YouTube downloader is missing.');
assert(typeof providers.downloader?.youtubeMp3 === 'function', 'YouTube local MP3 downloader alias is missing.');
assert(typeof providers.downloader?.facebook === 'function', 'Facebook fallback chain is missing.');
assert(typeof providers.downloader?.pinterest === 'function', 'Pinterest downloader is missing.');
assert(typeof providers.downloader?.twitter === 'function', 'Twitter downloader is missing.');
assert(typeof providers.downloader?.mediafire === 'function', 'MediaFire downloader is missing.');
assert(typeof providers.downloader?.googleDrive === 'function', 'Google Drive downloader is missing.');
let downloaderFallbackAttempts = 0;
const downloaderFallbackResult = await sendWithFallback({}, [
  { name: 'primary', run: async () => 'primary-response' },
  { name: 'fallback', run: async () => 'fallback-response' },
], async (response) => {
  downloaderFallbackAttempts += 1;
  if (response === 'primary-response') throw new Error('primary media URL unreachable');
  return response;
});
assert(downloaderFallbackResult === 'fallback-response' && downloaderFallbackAttempts === 2, 'Downloader must try the next provider when media fetch/send fails.');
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
const mockPng = renderMockUi({ title: 'SMOKE TEST', fields: [{ label: 'Status', value: 'OK' }] });
assert(Buffer.isBuffer(mockPng) && mockPng.length > 1000 && mockPng.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'Mock maker renderer failed.');

assert(disconnectStatus(undefined) === null, 'Missing WhatsApp disconnect error must not be treated as HTTP 500.');
assert(disconnectStatus(new Error('network failure')) === null, 'Generic errors must not be treated as bad sessions.');
assert(disconnectStatus({ output: { statusCode: 401 } }) === 401, 'Boom disconnect status extraction failed.');
assert(isInvalidSessionDisconnect(401), 'WhatsApp logged-out status should reset invalid auth.');
assert(!isInvalidSessionDisconnect(403), 'WhatsApp forbidden status must not trigger destructive auth reset.');
assert(!isInvalidSessionDisconnect(440), 'WhatsApp connection-replaced status must preserve auth.');
assert(isInvalidSessionDisconnect(411), 'WhatsApp multi-device mismatch should recover invalid auth.');
assert(isInvalidSessionDisconnect(500), 'WhatsApp bad-session status should recover invalid auth.');
assert(!isInvalidSessionDisconnect(408), 'WhatsApp timeout should use normal reconnect.');
assert(!isInvalidSessionDisconnect(515), 'WhatsApp restart-required should use normal reconnect.');
assert(recoveryDelay(1) === 1000 && recoveryDelay(4) === 8000, 'WhatsApp recovery backoff contract failed.');
assert(recoveryReason(401) === 'logged_out', 'WhatsApp recovery reason mapping failed.');
assert(recoveryReason(440) === 'connection_replaced', 'WhatsApp connection-replaced reason mapping failed.');

for (const removed of ['coins', 'balance', 'claim', 'pay', 'transfer', 'kirimcoin', 'coinlog', 'coinhistory', 'transactions', 'coinlb', 'coinleaderboard', 'rich']) {
  assert(registry.resolve(removed) === undefined, 'Removed economy command is still resolvable: ' + removed);
}

const bombSession = startBombGame('smoke');
const visibleBomb = getBombGame('smoke');
assert(visibleBomb?.userId === 'smoke', 'Bomb game session contract failed.');
assert(visibleBomb?.gameMessageId === null, 'Bomb game message-id contract failed.');
assert(visibleBomb?.bomb === undefined, 'Bomb location leaked from public session contract.');
assert(visibleBomb?.opened instanceof Set, 'Bomb game opened-state contract failed.');
assert(bombSession?.bomb === undefined, 'Bomb game start API leaked the internal bomb.');
assert(guessBomb('smoke', 0).reason === 'invalid', 'Bomb game invalid-input contract failed.');
stopBombGame('smoke');

const mathSession = startMathQuiz('smoke');
assert(getMathQuiz('smoke')?.answer === mathSession.answer, 'Math quiz session contract failed.');
assert(formatMathQuestion(mathSession).includes('='), 'Math quiz formatter contract failed.');
assert(answerMathQuiz('smoke', mathSession.answer).result === 'win', 'Math quiz answer contract failed.');
stopMathQuiz('smoke');

const formattedTrivia = formatMultipleChoice({
  category: 'Science',
  difficulty: 'easy',
  question: 'Which planet is known as the Red Planet?',
  correctAnswer: 'Mars',
  incorrectAnswers: ['Venus', 'Jupiter', 'Mercury'],
  source: 'SkyVerse offline',
});
assert(formattedTrivia.choices.length === 4, 'Trivia formatter must produce four answer choices.');
assert('ABCD'.includes(formattedTrivia.correctLetter), 'Trivia formatter must identify the correct answer letter.');
assert(formattedTrivia.choices.includes('Mars'), 'Trivia formatter dropped the correct answer.');

startMiniGame({
  userId: 'mini-game-smoke',
  chatId: 'mini-chat-smoke',
  gameMessageId: 'MINI-GAME-1',
  type: 'tebakangka',
  answer: 12,
  state: { minimum: 1, maximum: 30, attempts: 0, maxAttempts: 6 },
});
assert(getMiniGame('mini-game-smoke', 'mini-chat-smoke')?.type === 'tebakangka', 'Mini-game session was not created.');
assert(isMiniGameReply('mini-game-smoke', { chatId: 'mini-chat-smoke', stanzaId: 'MINI-GAME-1' }), 'Mini-game reply routing failed.');
const numberHint = answerMiniGame('mini-game-smoke', 'mini-chat-smoke', 'MINI-GAME-1', '5');
assert(numberHint.matched && numberHint.keep && numberHint.text.includes('Terlalu kecil'), 'Number-guessing hint contract failed.');
assert(updateMiniGameMessage('mini-game-smoke', 'mini-chat-smoke', 'MINI-GAME-2'), 'Mini-game message ID did not update.');
const numberWin = answerMiniGame('mini-game-smoke', 'mini-chat-smoke', 'MINI-GAME-2', '12');
assert(numberWin.matched && numberWin.complete && numberWin.text.includes('12'), 'Number-guessing win contract failed.');
assert(getMiniGame('mini-game-smoke', 'mini-chat-smoke') === null, 'Completed mini-game session was not removed.');

startMiniGame({
  userId: 'mini-quiz-smoke',
  chatId: 'mini-quiz-chat',
  gameMessageId: 'MINI-QUIZ-1',
  type: 'quizcepat',
  state: {
    questions: [
      { question: 'Two plus two?', category: 'Math', choices: ['4', '3', '2', '5'], correctLetter: 'A', correctAnswer: '4', source: 'SkyVerse offline' },
      { question: 'Three plus three?', category: 'Math', choices: ['6', '5', '7', '8'], correctLetter: 'A', correctAnswer: '6', source: 'SkyVerse offline' },
    ],
    index: 0,
    score: 0,
  },
});
const quizNext = answerMiniGame('mini-quiz-smoke', 'mini-quiz-chat', 'MINI-QUIZ-1', 'A');
assert(quizNext.matched && quizNext.keep && quizNext.text.includes('Soal 2/2'), 'Quick quiz did not advance to its next question.');
updateMiniGameMessage('mini-quiz-smoke', 'mini-quiz-chat', 'MINI-QUIZ-2');
const quizFinish = answerMiniGame('mini-quiz-smoke', 'mini-quiz-chat', 'MINI-QUIZ-2', 'A');
assert(quizFinish.matched && quizFinish.complete && quizFinish.text.includes('2/2'), 'Quick quiz final score contract failed.');
stopMiniGame('unused-user', 'unused-chat');


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

const dbSmokeDir = await mkdtemp(join(tmpdir(), 'skyverse-db-smoke-'));
const dbSmokePath = join(dbSmokeDir, 'data', 'skyverse.sqlite');
const dbSmokeLogger = { info() {}, warn() {}, error() {}, debug() {} };
let dbSmoke = null;
try {
  dbSmoke = await createDatabase(dbSmokePath, dbSmokeLogger);
  const repositories = createRepositories(dbSmoke);
  const smokeJid = '628123456789@s.whatsapp.net';
  repositories.users.upsert({
    jid: smokeJid,
    phoneJid: smokeJid,
    pushName: 'Smoke User',
    isBot: false,
  });
  repositories.settings.set('group', '120000000000000@g.us', 'group.welcome', JSON.stringify({ enabled: true }));
  repositories.commands.increment('ping', smokeJid);

  // close() must flush pending writes even when persist() was not called manually.
  await dbSmoke.close();
  dbSmoke = null;

  dbSmoke = await createDatabase(dbSmokePath, dbSmokeLogger);
  const restored = createRepositories(dbSmoke);
  assert(restored.users.get(smokeJid)?.push_name === 'Smoke User', 'Database user data did not survive a close/reopen cycle.');
  assert(restored.users.get(smokeJid)?.number === '628123456789', 'Database phone number did not survive a close/reopen cycle.');
  const wallet = restored.economy.get(smokeJid);
  assert(wallet?.coins === 500 && wallet?.limits === 10, 'New user wallet defaults are incorrect.');
  assert(restored.economy.consumeLimit(smokeJid, 1), 'Wallet could not consume one Limit.');
  assert(restored.economy.get(smokeJid)?.limits === 9, 'Limit deduction was not persisted in the repository.');
  assert(restored.economy.refundLimit(smokeJid, 1), 'Wallet could not refund one Limit.');
  assert(restored.economy.get(smokeJid)?.limits === 10, 'Limit refund did not restore the original balance.');
  assert(!restored.economy.consumeLimit(smokeJid, 11), 'Wallet allowed a negative Limit balance.');
  assert(restored.settings.get('group', '120000000000000@g.us', 'group.welcome') === JSON.stringify({ enabled: true }), 'Database settings did not survive a close/reopen cycle.');
  assert(restored.commands.stats().some((item) => item.command === 'ping' && item.usage_count === 1), 'Database command stats did not survive a close/reopen cycle.');
  await dbSmoke.close();
  dbSmoke = null;
} finally {
  if (dbSmoke) await dbSmoke.close().catch(() => {});
  await rm(dbSmokeDir, { recursive: true, force: true });
}

console.log(`SkyVerse smoke test passed: ${visibleCommands.length} visible commands + maker providers + downloader aliases + games + Canvas Rich + PTV resolver + database persistence tests.`);
