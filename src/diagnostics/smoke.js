import { createCommandRegistry } from '../commands/registry.js';
import { loadConfig } from '../config/env.js';
import { createProviderManager } from '../services/providers/manager.js';
import * as media from '../services/media/index.js';
import { downloadResolvedMedia, resolveMediaTarget } from '../services/media/resolver.js';
import { startBombGame, getBombGame, guessBomb, stopBombGame } from '../games/bomb.js';
import { startMathQuiz, getMathQuiz, answerMathQuiz, stopMathQuiz, formatMathQuestion } from '../games/mathquiz.js';
import { startTicTacToe, getTicTacToe, playTicTacToe, surrenderTicTacToe, parseTicTacToeInput } from '../games/tictactoe.js';
import { renderTicTacToe } from '../platform/whatsapp/tictactoe-canvas.js';
import { renderAllMenu } from '../platform/whatsapp/allmenu-canvas.js';
import { economyDefaults, EconomyManager } from '../economy/manager.js';
import { normalizePhoneNumber } from '../security/identity.js';
import { createRichMessage, htmlToText } from '../platform/whatsapp/rich.js';
import { MENU_CATEGORY_DEFINITIONS } from '../core/menu-categories.js';
import { createGroupService } from '../services/group.js';
import { createFeatureLimitService } from '../services/feature-limits.js';
import { createCanvas } from 'canvas';
import { spawnSync } from 'node:child_process';
import { createMessageEngine } from '../message/engine.js';
import { WAMessageStubType } from '@whiskeysockets/baileys';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const config = loadConfig({});
const registry = await createCommandRegistry();
const providers = createProviderManager(config);
const visibleCommands = registry.all({ includeHidden: false });
const visibleNames = new Set(visibleCommands.map((command) => command.name));

for (const required of ['menu', 'help', 'ping', 'info', 'owner', 'allmenu', 'coin', 'limit', 'claim', 'work', 'mathquiz', 'sticker', 'brat', 'bratvid', 'iqc', 'smeme', 'stickerwatermark', 'tomp3', 'tomp4', 'toimg', 'tovideo', 'tovn', 'texttoqr', 'hd', 'removebg', 'warn', 'unwarn', 'delete']) assert(visibleNames.has(required), `Missing visible command: ${required}`);
for (const removed of ['tictactoe', 'a2uitest', 'add', 'warnings', 'ytmp4']) {
  assert(!visibleNames.has(removed), `Removed command is still visible: ${removed}`);
  assert(registry.resolve(removed) === undefined, `Removed command is still resolvable: ${removed}`);
}
for (const command of visibleCommands) {
  assert(typeof command.execute === 'function', `Command ${command.name} has no execute().`);
  assert(['owner', 'admin', 'premium', 'npc'].includes(command.access), `Invalid access group: ${command.name}`);
  assert(Number.isInteger(command.cost) && command.cost >= 0, `Invalid coin cost: ${command.name}`);
}
assert(registry.resolve('balance')?.name === 'coin', 'Balance alias does not resolve to the canonical coin command.');
assert(registry.resolve('coins')?.name === 'coin', 'Coins alias does not resolve to the canonical coin command.');
assert(config.featureLimitDefault === 10, 'Default feature limit configuration regression.');
assert(loadConfig({ FEATURE_LIMIT_DEFAULT: '4' }).featureLimitDefault === 4, 'Custom feature limit configuration regression.');
assert(loadConfig({ FEATURE_LIMIT_DEFAULT: '-2' }).featureLimitDefault === 10, 'Invalid feature limit must fall back to a safe default.');

const limitStore = new Map();
const limitService = createFeatureLimitService({
  settings: {
    get: (scope, scopeId, key, fallback = null) => limitStore.get([scope, scopeId, key].join(':')) ?? fallback,
    set: (scope, scopeId, key, value) => limitStore.set([scope, scopeId, key].join(':'), String(value)),
  },
}, { defaultLimit: 2 });
const limitUser = 'limit-user@s.whatsapp.net';
const limitedFeature = { name: 'tiktok', category: 'downloader' };
const unlimitedFeature = { name: 'ping', category: 'general' };
const quotaTime = Date.parse('2026-11-20T01:00:00.000Z');
const firstQuota = limitService.consume(limitUser, limitedFeature, quotaTime);
const secondQuota = limitService.consume(limitUser, limitedFeature, quotaTime);
const exhaustedQuota = limitService.consume(limitUser, limitedFeature, quotaTime);
assert(firstQuota.ok && firstQuota.remaining === 1, 'First feature-limit reservation failed.');
assert(secondQuota.ok && secondQuota.remaining === 0, 'Second feature-limit reservation failed.');
assert(!exhaustedQuota.ok && exhaustedQuota.used === 2, 'Feature limit did not block usage after quota exhaustion.');
assert(limitService.snapshot(limitUser, [limitedFeature, unlimitedFeature], quotaTime).length === 1, 'Non-limited commands should not appear in feature-limit status.');
assert(limitService.snapshot(limitUser, [limitedFeature], quotaTime)[0]?.used === 2, 'Feature limit usage was not persisted.');
assert(limitService.refund(secondQuota.reservation), 'Failed command quota reservation could not be refunded.');
assert(limitService.snapshot(limitUser, [limitedFeature], quotaTime)[0]?.remaining === 1, 'Feature-limit refund did not restore one use.');
const nextDay = Date.parse('2026-11-21T01:00:00.000Z');
assert(limitService.snapshot(limitUser, [limitedFeature], nextDay)[0]?.used === 0, 'Daily feature limits did not reset at Jakarta midnight.');

let ownerLimitReply = '';
await registry.resolve('limit').execute({
  isOwner: true,
  reply: async (text) => { ownerLimitReply = text; },
});
assert(ownerLimitReply.includes('Unlimited (Owner)'), 'Owner limit status is not unlimited.');

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
const ffmpegProbe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
if (ffmpegProbe.status === 0) {
  const frameOne = createCanvas(8, 8);
  const frameTwo = createCanvas(8, 8);
  frameOne.getContext('2d').fillRect(0, 0, 8, 8);
  frameTwo.getContext('2d').fillStyle = '#fff';
  frameTwo.getContext('2d').fillRect(0, 0, 8, 8);
  const animatedSticker = await media.toAnimatedStickerFromFrames([
    frameOne.toBuffer('image/png'),
    frameTwo.toBuffer('image/png'),
  ]);
  assert(animatedSticker.subarray(0, 4).toString('ascii') === 'RIFF' && animatedSticker.subarray(8, 12).toString('ascii') === 'WEBP', 'BratVid output is not a WebP file.');
  const frameMarkers = [...animatedSticker.toString('latin1').matchAll(/ANMF/g)];
  assert(frameMarkers.length >= 2, 'BratVid output does not contain multiple animation frames.');
} else {
  console.log('Skipping live BratVid encoding smoke test: ffmpeg is unavailable in this runner.');
}
assert(typeof downloadResolvedMedia === 'function', 'Central media downloader export is missing.');
assert(typeof resolveMediaTarget === 'function', 'Media target resolver export is missing.');
assert(MENU_CATEGORY_DEFINITIONS.some((item) => item.key === 'media' && item.label === 'Media'), 'Media menu category is missing.');
for (const name of ['toimg', 'tomp3', 'tomp4', 'tovideo', 'tovn', 'tonote']) {
  assert(registry.resolve(name)?.category === 'media', `${name} must be in the Media category.`);
}

let fakeUser = { jid: 'smoke@lid', number: '628000000000', coins: economyDefaults.newUserCoins, is_premium: 0, premium_until: null, last_claim_at: 0 };
const fakeRepositories = {
  users: { get: () => fakeUser, upsert: () => ({ created: false, user: fakeUser }) },
  economy: {
    credit: ({ amount }) => { fakeUser.coins += amount; return { ok: true, balance: fakeUser.coins, added: amount }; },
    debit: ({ amount }) => { if (fakeUser.coins < amount) return { ok: false, balance: fakeUser.coins, required: amount }; fakeUser.coins -= amount; return { ok: true, balance: fakeUser.coins, spent: amount, required: amount }; },
    claim: ({ amount, now }) => { if (now - fakeUser.last_claim_at < economyDefaults.claimCooldownMs) return { ok: false, remaining: economyDefaults.claimCooldownMs - (now - fakeUser.last_claim_at), balance: fakeUser.coins }; fakeUser.coins += amount; fakeUser.last_claim_at = now; return { ok: true, amount, balance: fakeUser.coins, nextClaimAt: now + economyDefaults.claimCooldownMs }; },
    history: () => [],
  },
};
const economy = new EconomyManager({ repositories: fakeRepositories });
assert(economy.getCoins('smoke@lid') === 100, 'Economy default wallet is not 100 coins.');
const spent = economy.spendCoins('smoke@lid', 10, 'smoke');
assert(spent.ok && spent.balance === 90, 'Economy debit contract failed.');
const credited = economy.addCoins('smoke@lid', 10, 'smoke');
assert(credited === 100, 'Economy credit contract failed.');
const claim = economy.claim('smoke@lid', Date.now());
assert(claim.ok && claim.amount >= 2 && claim.amount <= 7, 'Economy claim reward contract failed.');

const bombSession = startBombGame('smoke');
const visibleBomb = getBombGame('smoke');
assert(visibleBomb?.userId === 'smoke', 'Bomb game session contract failed.');
assert(visibleBomb?.gameMessageId === null, 'Bomb game message-id contract failed.');
assert(visibleBomb?.bomb === undefined, 'Bomb location leaked from public session contract.');
assert(visibleBomb?.opened instanceof Set, 'Bomb game opened-state contract failed.');
assert(bombSession?.bomb === undefined && bombSession?.opened instanceof Set, 'Bomb game start public-session contract failed.');
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
assert(parseTicTacToeInput('tictactoe:5')?.position === '5', 'Tic-Tac-Toe button parser regression.');
assert(parseTicTacToeInput('5')?.source === 'reply', 'Tic-Tac-Toe reply parser regression.');
assert(parseTicTacToeInput('five') === null, 'Tic-Tac-Toe accepted invalid input.');
assert(playTicTacToe('smoke-ttt', p1, 1).ok, 'Tic-Tac-Toe first move contract failed.');
assert(playTicTacToe('smoke-ttt', p1, 2).reason === 'not_your_turn', 'Tic-Tac-Toe turn contract failed.');
assert(playTicTacToe('smoke-ttt', p2, 5).ok, 'Tic-Tac-Toe second move contract failed.');
assert(renderTicTacToe(['X', null, null, null, 'O', null, null, null, null]).length > 100, 'Tic-Tac-Toe Canvas render contract failed.');
const allMenuImage = renderAllMenu({ groups: registry.byCategory({ includeHidden: false }), total: visibleCommands.length });
assert(Buffer.isBuffer(allMenuImage) && allMenuImage.length > 1000, 'Allmenu Canvas image render contract failed.');
let allMenuMedia = null;
await registry.resolve('allmenu').execute({
  registry,
  config: { botName: 'SkyVerse', prefix: '.' },
  message: { pushName: 'Smoke' },
  user: { is_premium: false, coins: 100 },
  media: { send: async (buffer, type, options) => { allMenuMedia = { buffer, type, options }; } },
});
assert(Buffer.isBuffer(allMenuMedia?.buffer) && allMenuMedia.type === 'image', 'Allmenu command did not send its rendered image.');
assert(allMenuMedia.options?.mimetype === 'image/png' && allMenuMedia.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Allmenu media payload is not a valid PNG image.');

assert(registry.resolve('daily')?.name === 'claim', 'Daily economy alias regression.');
assert(registry.resolve('kerja')?.name === 'work', 'Work economy alias regression.');
assert(surrenderTicTacToe('smoke-ttt', p1).result === 'surrender', 'Tic-Tac-Toe surrender contract failed.');
assert(getTicTacToe('smoke-ttt') === null, 'Tic-Tac-Toe cleanup contract failed.');

let tagAllPayload = null;
const groupService = createGroupService();
await groupService.tagAll({
  isGroup: true,
  chatId: '120000000000000@g.us',
  getGroupMetadata: async () => ({ participants: [{ id: '111111111111111@s.whatsapp.net' }, { id: '222222222222222@lid' }] }),
  socket: { sendMessage: async (_jid, payload) => { tagAllPayload = payload; } },
}, 'Halo anggota!');
assert(tagAllPayload?.mentions?.length === 2, 'Tagall mention metadata contract failed.');
assert(tagAllPayload?.text?.includes('@111111111111111') && tagAllPayload.text.includes('@222222222222222'), 'Tagall visible mentions contract failed.');

const messageListeners = new Map();
const emittedMessages = [];
let revokerId = '333333333333333@s.whatsapp.net';
let revokerPhone = null;
let revokerRole = undefined;
let outgoingId = 0;
const engineRepositories = {
  users: { get: () => undefined, upsert: () => ({ created: false }) },
  groups: { upsert: () => {} },
  settings: {
    get: (_scope, _scopeId, key, fallback = null) => key === 'group.antidelete'
      ? JSON.stringify({ enabled: true, destination: null, ttl: 1800000 })
      : fallback,
    set: () => {},
  },
  commands: { increment: () => {} },
};
const messageEngine = createMessageEngine({
  config: { prefix: '.', autoRead: false },
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  identity: { isOwner: (value) => normalizePhoneNumber(value) === '628888888888' },
  registry,
  repositories: engineRepositories,
  economy: { addCoins: () => 100, getWallet: () => ({ coins: 100 }), spendCoins: () => ({ ok: true }) },
  providers,
});
const mockSocket = {
  user: { id: '999999999999999@s.whatsapp.net' },
  ev: { on: (event, listener) => messageListeners.set(event, listener) },
  groupMetadata: async () => ({
    participants: [{ id: revokerId, ...(revokerPhone ? { pn: revokerPhone } : {}), ...(revokerRole ? { admin: revokerRole } : {}) }],
  }),
  sendMessage: async (jid, payload, options) => {
    emittedMessages.push({ jid, payload, options });
    outgoingId += 1;
    return { key: { id: `ENGINE-OUT-${outgoingId}` } };
  },
  readMessages: async () => {},
};
messageEngine.attach(mockSocket);

async function cacheGroupMessage(id, sender = '111111111111111@s.whatsapp.net') {
  await messageEngine.handleMessage(mockSocket, {
    key: { remoteJid: '120000000000000@g.us', id, participant: sender, fromMe: false },
    message: { conversation: 'Original test message' },
    pushName: 'Member',
  });
}
const revokeHandler = messageListeners.get('messages.update');
await cacheGroupMessage('REVOKE-NON-ADMIN');
const beforeNonAdminRevoke = emittedMessages.length;
await revokeHandler([{
  key: { remoteJid: '120000000000000@g.us', id: 'REVOKE-NON-ADMIN', participant: revokerId, fromMe: false },
  update: { messageStubType: WAMessageStubType.REVOKE },
}]);
assert(emittedMessages.length === beforeNonAdminRevoke + 2, 'Anti-delete did not emit explanation and forwarded message for a regular member.');
assert(emittedMessages.at(-2)?.payload?.text?.includes('@333333333333333'), 'Anti-delete did not visibly tag the deleter.');
assert(emittedMessages.at(-1)?.payload?.forward?.key?.id === 'REVOKE-NON-ADMIN', 'Anti-delete did not forward the original deleted message.');

revokerId = '444444444444444@s.whatsapp.net';
revokerPhone = null;
revokerRole = 'admin';
await cacheGroupMessage('REVOKE-ADMIN');
const beforeAdminRevoke = emittedMessages.length;
await revokeHandler([{
  key: { remoteJid: '120000000000000@g.us', id: 'REVOKE-ADMIN', participant: revokerId, fromMe: false },
  update: { messageStubType: WAMessageStubType.REVOKE },
}]);
assert(emittedMessages.length === beforeAdminRevoke, 'Anti-delete must ignore messages revoked by a group admin.');

revokerId = '555555555555555@lid';
revokerPhone = '628888888888@s.whatsapp.net';
revokerRole = undefined;
await cacheGroupMessage('REVOKE-OWNER');
const beforeOwnerRevoke = emittedMessages.length;
await revokeHandler([{
  key: { remoteJid: '120000000000000@g.us', id: 'REVOKE-OWNER', participant: revokerId, participantAlt: revokerPhone, fromMe: false },
  update: { messageStubType: WAMessageStubType.REVOKE },
}]);
assert(emittedMessages.length === beforeOwnerRevoke, 'Anti-delete must ignore messages revoked by the configured owner.');

const engineTttChat = '130000000000000@g.us';
const engineTttPlayer = '666666666666666@s.whatsapp.net';
startTicTacToe(engineTttChat, { player1: engineTttPlayer, player2: '777777777777777@s.whatsapp.net', gameMessageId: 'ENGINE-TTT-BOARD' });
await messageEngine.handleMessage(mockSocket, {
  key: { remoteJid: engineTttChat, id: 'ENGINE-TTT-MOVE', participant: engineTttPlayer, fromMe: false },
  message: { extendedTextMessage: { text: '5', contextInfo: { stanzaId: 'ENGINE-TTT-BOARD' } } },
});
assert(getTicTacToe(engineTttChat)?.board[4] === 'X', 'Message engine failed to route a Tic-Tac-Toe numeric reply.');
assert(Boolean(getTicTacToe(engineTttChat)?.gameMessageId) && getTicTacToe(engineTttChat).gameMessageId !== 'ENGINE-TTT-BOARD', 'Tic-Tac-Toe did not track its refreshed board message.');

const deleteCommand = registry.resolve('delete');
let deletePayload = null;
let deletePermissionError = '';
const quotedMemberMessage = {
  message: { extendedTextMessage: { contextInfo: { stanzaId: 'DELETE-TEST', participant: '111111111111111@s.whatsapp.net' } } },
};
const baseDeleteContext = {
  message: quotedMemberMessage,
  isChannel: false,
  isGroup: true,
  chatId: '120000000000000@g.us',
  socket: {
    user: { id: '999999999999999@s.whatsapp.net' },
    sendMessage: async (_jid, payload) => { deletePayload = payload; },
  },
  react: async () => {},
};
try {
  await deleteCommand.execute({
    ...baseDeleteContext,
    capabilities: { check: async () => ({ known: true, isAdmin: false }) },
  });
} catch (error) {
  deletePermissionError = error.message;
}
assert(deletePermissionError.includes('Bot harus menjadi admin grup'), 'Delete did not explain the missing bot-admin permission.');
assert(deletePayload === null, 'Delete attempted an unauthorized group deletion.');
await deleteCommand.execute({
  ...baseDeleteContext,
  capabilities: { check: async () => ({ known: true, isAdmin: true }) },
});
assert(deletePayload?.delete?.id === 'DELETE-TEST' && deletePayload.delete.fromMe === false, 'Delete did not send the quoted group message key after admin authorization.');

const quotaUsers = new Map();
const quotaStorage = new Map();
const quotaResponses = [];
let limitedExecutions = 0;
const limitedCommand = {
  name: 'tiktok',
  category: 'downloader',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 0,
  cost: 0,
  execute: async () => { limitedExecutions += 1; },
};
const quotaRepositories = {
  users: {
    get: (jid) => quotaUsers.get(jid),
    upsert: ({ jid, pushName = null }) => {
      const user = quotaUsers.get(jid) ?? { jid, number: null, coins: 100, is_premium: 0, push_name: pushName };
      quotaUsers.set(jid, user);
      return { created: false, user };
    },
  },
  groups: { upsert: () => {} },
  settings: {
    get: (scope, id, key, fallback = null) => quotaStorage.get([scope, id, key].join(':')) ?? fallback,
    set: (scope, id, key, value) => quotaStorage.set([scope, id, key].join(':'), String(value)),
  },
  commands: { increment: () => {} },
};
const quotaEconomy = {
  ensureUser: (jid, { pushName = null } = {}) => {
    const user = quotaUsers.get(jid) ?? { jid, number: null, coins: 100, is_premium: 0, push_name: pushName };
    quotaUsers.set(jid, user);
    return user;
  },
  getWallet: () => ({ coins: 100 }),
};
const quotaEngine = createMessageEngine({
  config: { prefix: '.', autoRead: false, featureLimitDefault: 1 },
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  identity: { isOwner: () => false },
  registry: { resolve: (name) => name === 'tiktok' ? limitedCommand : undefined },
  repositories: quotaRepositories,
  economy: quotaEconomy,
  providers,
});
const quotaSocket = {
  sendMessage: async (_jid, payload) => { quotaResponses.push(payload); return { key: { id: `QUOTA-OUT-${quotaResponses.length}` } }; },
  readMessages: async () => {},
};
await quotaEngine.handleMessage(quotaSocket, {
  key: { remoteJid: 'quota-user@s.whatsapp.net', id: 'LIMIT-1', fromMe: false },
  message: { conversation: '.tiktok' },
  pushName: 'Quota User',
});
await quotaEngine.handleMessage(quotaSocket, {
  key: { remoteJid: 'quota-user@s.whatsapp.net', id: 'LIMIT-2', fromMe: false },
  message: { conversation: '.tiktok' },
  pushName: 'Quota User',
});
assert(limitedExecutions === 1, 'Message engine did not enforce the configured per-feature daily limit.');
assert(quotaResponses.some((payload) => payload.text?.includes('Limit .tiktok habis (1/1)')), 'Message engine did not explain exhausted feature quota.');

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
