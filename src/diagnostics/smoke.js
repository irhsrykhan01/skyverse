import { createCommandRegistry } from '../commands/registry.js';
import { loadConfig } from '../config/env.js';
import { createProviderManager } from '../services/providers/manager.js';
import * as media from '../services/media/index.js';
import { downloadResolvedMedia, resolveMediaTarget } from '../services/media/resolver.js';
import { startBombGame, getBombGame, guessBomb, stopBombGame } from '../games/bomb.js';
import { startMathQuiz, getMathQuiz, answerMathQuiz, stopMathQuiz, formatMathQuestion } from '../games/mathquiz.js';
import { startTicTacToe, getTicTacToe, playTicTacToe, surrenderTicTacToe } from '../games/tictactoe.js';
import { renderTicTacToe } from '../platform/whatsapp/tictactoe-canvas.js';
import { normalizePhoneNumber } from '../security/identity.js';
import { createRichMessage, htmlToText } from '../platform/whatsapp/rich.js';
import { isInvalidSessionDisconnect, recoveryDelay, recoveryReason } from '../platform/whatsapp/recovery.js';
import { renderMockUi } from '../services/mock-ui.js';
import { resolveMenuCategory } from '../core/menu-categories.js';
import { command as allmenuCommand } from '../commands/general/allmenu.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const config = loadConfig({});
const registry = await createCommandRegistry();
const providers = createProviderManager(config);
assert(config.depayBaseUrl === undefined, 'Removed Depay configuration is still present.');
assert(providers.depay === undefined, 'Removed Depay provider is still exposed.');
assert(providers.siputzx && typeof providers.siputzx.youtube === 'function', 'Siputzx YouTube provider is not exposed.');
assert(resolveMenuCategory('economy') === null, 'Removed economy menu category is still registered.');
const visibleCommands = registry.all({ includeHidden: false });
const visibleNames = new Set(visibleCommands.map((command) => command.name));

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
const allmenuAdReply = allmenuTextPayload?.externalAdReply;
assert(allmenuAdReply?.title === 'SkyVerse', 'Allmenu externalAdReply title contract failed.');
assert(allmenuAdReply?.body === 'All-in-one WhatsApp virtual bot assistant.', 'Allmenu externalAdReply body contract failed.');
assert(allmenuAdReply?.mediaType === 1, 'Allmenu externalAdReply mediaType contract failed.');
assert(Buffer.isBuffer(allmenuAdReply?.thumbnail) && allmenuAdReply.thumbnail.length > 0, 'Allmenu externalAdReply thumbnail contract failed.');
assert(allmenuAdReply?.url === 'https://saweria.co/irhsrykhn', 'Allmenu externalAdReply URL contract failed.');
assert(allmenuAdReply?.largeThumbnail === true, 'Allmenu externalAdReply large thumbnail contract failed.');
for (const required of ['menu', 'help', 'ping', 'info', 'owner', 'sticker', 'brat', 'bratvid', 'brathd', 'iqc', 'smeme', 'stickerwatermark', 'tomp3', 'tomp4', 'toimg', 'tovideo', 'tovn', 'texttoqr', 'hd', 'removebg', 'warn', 'unwarn', 'delete', 'pinterest', 'twitter', 'mediafire', 'gdrive', 'fakecall', 'fakewagroup', 'fakewachannel', 'fakettprofile', 'fakettcomment', 'fakefbcomment', 'mockwallet']) assert(visibleNames.has(required), `Missing visible command: ${required}`);
for (const removed of ['tictactoe', 'a2uitest', 'add', 'warnings', 'ytmp4']) { assert(!visibleNames.has(removed), `Removed command is still visible: ${removed}`); assert(registry.resolve(removed) === undefined, `Removed command is still resolvable: ${removed}`); }
for (const command of visibleCommands) { assert(typeof command.execute === 'function', `Command ${command.name} has no execute().`); assert(['owner', 'admin', 'premium', 'npc'].includes(command.access), `Invalid access group: ${command.name}`); }
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
assert(config.delineBaseUrl === 'https://api.deline.web.id', 'Default Deline URL regression.');
assert(config.zenzxzBaseUrl === 'https://api.zenzxz.my.id', 'Default Zenzxz URL regression.');
assert(config.vredenBaseUrl === 'https://api.vreden.my.id', 'Default Vreden URL regression.');
assert(config.tikwmBaseUrl === 'https://www.tikwm.com/api/', 'Default TikWM URL regression.');
assert(config.reelsVideoBaseUrl === 'https://reelsvideo.io', 'Default ReelsVideo URL regression.');
assert(typeof providers.downloader?.tiktok === 'function', 'TikWM downloader is missing.');
assert(typeof providers.downloader?.instagram === 'function', 'ReelsVideo downloader is missing.');
assert(typeof providers.downloader?.youtube === 'function', 'YouTube fallback chain is missing.');
assert(typeof providers.downloader?.youtubeMp3 === 'function', 'YouTube MP3 fallback chain is missing.');
assert(typeof providers.downloader?.facebook === 'function', 'Facebook fallback chain is missing.');
assert(typeof providers.downloader?.pinterest === 'function', 'Pinterest downloader is missing.');
assert(typeof providers.downloader?.twitter === 'function', 'Twitter downloader is missing.');
assert(typeof providers.downloader?.mediafire === 'function', 'MediaFire downloader is missing.');
assert(typeof providers.downloader?.googleDrive === 'function', 'Google Drive downloader is missing.');
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

assert(isInvalidSessionDisconnect(401), 'WhatsApp logged-out status is not recoverable.');
assert(isInvalidSessionDisconnect(440), 'WhatsApp connection-replaced status is not recoverable.');
assert(isInvalidSessionDisconnect(500), 'WhatsApp bad-session status is not recoverable.');
assert(!isInvalidSessionDisconnect(408), 'WhatsApp timeout should use normal reconnect.');
assert(!isInvalidSessionDisconnect(515), 'WhatsApp restart-required should use normal reconnect.');
assert(recoveryDelay(1) === 1000 && recoveryDelay(4) === 8000, 'WhatsApp recovery backoff contract failed.');
assert(recoveryReason(401) === 'logged_out', 'WhatsApp recovery reason mapping failed.');
assert(recoveryReason(440) === 'connection_replaced', 'WhatsApp connection-replaced reason mapping failed.');

for (const removed of ['balance', 'coin', 'coins', 'bal', 'claim', 'daily', 'harian', 'pay', 'transfer', 'kirimcoin', 'coinlog', 'coinhistory', 'transactions', 'coinlb', 'coinleaderboard', 'rich']) {
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

console.log(`SkyVerse smoke test passed: ${visibleCommands.length} visible commands + maker providers + downloader aliases + games + Canvas Rich + PTV resolver tests.`);
