import { EventEmitter } from 'node:events';
import { WAMessageStubType } from '@whiskeysockets/baileys';
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
import { resolveMenuCategory } from '../core/menu-categories.js';
import { command as allmenuCommand } from '../commands/general/allmenu.js';
import { sendWithFallback, sendVideoAsMp3 } from '../commands/downloader/_generic.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, createRepositories } from '../database/index.js';
import { createGroupService } from '../services/group.js';
import { createMessageEngine } from '../message/engine.js';
import { createSairiHostMakerProvider } from '../services/providers/sairihost-makers.js';
import { command as antideleteCommand } from '../commands/group/antidelete.js';
import { command as deleteCommand } from '../commands/general/delete.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const config = loadConfig({});
const registry = await createCommandRegistry();
const providers = createProviderManager(config);
assert(config.depayBaseUrl === undefined, 'Removed Depay configuration is still present.');
assert(providers.depay === undefined, 'Removed Depay provider is still exposed.');
assert(providers.siputzx && typeof providers.siputzx.youtube === 'function', 'Legacy Siputzx provider should remain isolated from the main downloader.');
assert(providers.ytdlp && typeof providers.ytdlp.youtube === 'function' && typeof providers.ytdlp.instagram === 'function' && typeof providers.ytdlp.tiktok === 'function', 'Local yt-dlp provider is missing TikTok support.');
assert(config.ytDlpPath === 'yt-dlp', 'Default yt-dlp executable path is incorrect.');
assert(typeof sendVideoAsMp3 === 'function', 'Local video-to-MP3 conversion helper is missing.');
assert(resolveMenuCategory('economy') === null, 'Removed economy menu category is still registered.');
assert(resolveMenuCategory('custom-tools', new Map([['custom-tools', []]])) === 'custom-tools', 'New menu categories must resolve from the command registry.');
assert(resolveMenuCategory('media') === 'media', 'Media menu category is missing.');
const visibleCommands = registry.all({ includeHidden: false });
const visibleNames = new Set(visibleCommands.map((command) => command.name));
const registeredCategories = registry.byCategory({ includeHidden: false });
assert(!registeredCategories.has('economy'), 'Removed economy menu category is still registered in command registry.');
for (const [category, items] of registeredCategories) {
  assert(items.every((item) => item.category === category), 'Command category grouping is inconsistent: ' + category);
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
const allmenuImagePayload = allmenuPayloads.find((payload) => Buffer.isBuffer(payload.image) && typeof payload.caption === 'string');
assert(Buffer.isBuffer(allmenuImagePayload?.image) && allmenuImagePayload.image.length > 0, 'Allmenu must send a real image payload.');
assert(typeof allmenuImagePayload?.caption === 'string' && allmenuImagePayload.caption.includes('Dukung SkyVerse:'), 'Allmenu image caption contract failed.');
assert(!allmenuImagePayload?.text && !allmenuImagePayload?.contextInfo?.externalAdReply, 'Allmenu must not rely on a link-preview image.');
for (const item of visibleCommands) {
  assert(allmenuImagePayload.caption.includes(config.prefix + item.name), 'Allmenu is missing registered command: ' + item.name);
}

const groupService = createGroupService();
const mockParticipants = [
  { id: '628111111111@s.whatsapp.net', pn: '628111111111@s.whatsapp.net', admin: 'admin' },
  { id: '628222222222@s.whatsapp.net', pn: '628222222222@s.whatsapp.net', admin: null },
  { id: '628555555555@s.whatsapp.net', pn: '628555555555@s.whatsapp.net', admin: 'admin' },
  ...Array.from({ length: 21 }, (_, index) => {
    const number = String(628333333333 + index);
    return index === 0
      ? { id: '104000000000@lid', pn: number + '@s.whatsapp.net', admin: null }
      : { id: number + '@s.whatsapp.net', pn: number + '@s.whatsapp.net', admin: null };
  }),
];
const groupMessages = [];
const groupActions = [];
const mockGroupContext = {
  isGroup: true,
  chatId: '120363000000000000@g.us',
  senderJid: '628111111111@s.whatsapp.net',
  senderPhoneJid: null,
  message: { message: {} },
  parsed: { args: ['628222222222'] },
  config: { prefix: '.' },
  getGroupMetadata: async () => ({ participants: mockParticipants }),
  capabilities: {
    check: async () => ({ known: true, isAdmin: true, metadata: { participants: mockParticipants } }),
  },
  socket: {
    user: { id: '628000000000@s.whatsapp.net' },
    sendMessage: async (_jid, payload) => {
      groupMessages.push(payload);
      return { key: { id: 'GROUP-SMOKE-' + groupMessages.length } };
    },
    groupParticipantsUpdate: async (_jid, jids, action) => {
      groupActions.push({ jids: [...jids], action });
      return jids.map((jid) => ({ jid, status: action === 'remove' ? '200' : '500' }));
    },
  },
};
const kickResult = await groupService.kick(mockGroupContext);
assert(kickResult.removed === 1, 'Kick must report confirmed removal count.');
assert(groupActions.length === 1 && groupActions[0].action === 'remove', 'Kick must call Baileys with the remove action.');
assert(groupActions[0].jids.includes('628222222222@s.whatsapp.net'), 'Kick must send the resolved member JID to Baileys.');
let rejectedFailedKick = false;
try {
  await groupService.kick({
    ...mockGroupContext,
    socket: {
      ...mockGroupContext.socket,
      groupParticipantsUpdate: async (_jid, jids) => jids.map((jid) => ({ jid, status: '403' })),
    },
  });
} catch {
  rejectedFailedKick = true;
}
assert(rejectedFailedKick, 'Kick must reject when WhatsApp reports a failed removal.');
let rejectedAdminKick = false;
try {
  await groupService.kick({
    ...mockGroupContext,
    parsed: { args: ['628555555555'] },
  });
} catch (error) {
  rejectedAdminKick = String(error?.message ?? '').includes('Target adalah admin grup');
}
assert(rejectedAdminKick, 'Kick must refuse to remove a group admin.');
assert(groupMessages.length === 0, 'Kick must not send tag-all messages.');
await groupService.tagAll(mockGroupContext, 'SMOKE TAG ALL');
assert(groupMessages.length === 2, 'Tagall must split large groups into bounded mention batches.');
assert(groupMessages.reduce((total, item) => total + (item.mentions?.length ?? 0), 0) === mockParticipants.length, 'Tagall must mention every unique group participant.');
assert(groupMessages.every((item) => typeof item.text === 'string' && item.mentions?.length > 0), 'Tagall must send visible mention tokens paired with mention JIDs.');
let privateAntideleteDestinationRejected = false;
try {
  await antideleteCommand.execute({
    isGroup: true,
    chatId: '120363000000000000@g.us',
    parsed: { args: ['on', '628111111111@s.whatsapp.net'] },
    repositories: { settings: {} },
    config: { prefix: '.' },
    socket: { user: { id: '628000000000@s.whatsapp.net' } },
    reply: async () => {},
    getGroupMetadata: async () => ({ participants: [] }),
  });
} catch (error) {
  privateAntideleteDestinationRejected = String(error?.message ?? '').startsWith('USER_INPUT:')
    && String(error?.message ?? '').includes('bukan chat pribadi');
}
assert(privateAntideleteDestinationRejected, 'Anti-delete must reject private-chat log destinations.');
let unprivilegedLogGroupRejected = false;
try {
  await antideleteCommand.execute({
    isGroup: true,
    chatId: '120363000000000000@g.us',
    senderJid: '628222222222@s.whatsapp.net',
    senderPhoneJid: null,
    parsed: { args: ['on', '120363000000000001@g.us'] },
    repositories: { settings: {} },
    config: { prefix: '.' },
    socket: {
      user: { id: '628000000000@s.whatsapp.net' },
      groupMetadata: async () => ({
        participants: [
          { id: '628000000000@s.whatsapp.net', admin: 'admin' },
          { id: '628222222222@s.whatsapp.net', admin: null },
        ],
      }),
    },
    reply: async () => {},
    getGroupMetadata: async () => ({ participants: [] }),
  });
} catch (error) {
  unprivilegedLogGroupRejected = String(error?.message ?? '').startsWith('USER_INPUT:')
    && String(error?.message ?? '').includes('admin di grup tujuan');
}
assert(unprivilegedLogGroupRejected, 'Anti-delete must require the configuring sender to be admin in the log group.');

const antiDeleteGroupJid = '120363000000000002@g.us';
const antiDeleteSent = [];
const antiDeleteMembers = [
  { id: '628700000001@s.whatsapp.net', admin: null },
  { id: '628700000002@s.whatsapp.net', admin: 'admin' },
];
const antiDeleteRepositories = {
  settings: {
    get: (scope, jid, key, fallback) => scope === 'group' && jid === antiDeleteGroupJid && key === 'group.antidelete'
      ? JSON.stringify({ enabled: true, destination: antiDeleteGroupJid, ttl: 1800000 })
      : fallback,
  },
  users: { upsert: () => {}, get: () => null },
  groups: { upsert: () => {} },
};
const antiDeleteSocket = {
  ev: new EventEmitter(),
  user: { id: '628700000003@s.whatsapp.net' },
  groupMetadata: async () => ({ participants: antiDeleteMembers }),
  sendMessage: async (jid, payload) => {
    antiDeleteSent.push({ jid, payload });
    return { key: { id: 'ANTI-DELETE-SMOKE-' + antiDeleteSent.length } };
  },
};
const antiDeleteEngine = createMessageEngine({
  config: { prefix: '.', autoRead: false, autoOnline: false },
  logger: { info: () => {}, debug: () => {}, error: () => {} },
  identity: { isOwner: () => false },
  registry: {},
  repositories: antiDeleteRepositories,
  providers: {},
});
antiDeleteEngine.attach(antiDeleteSocket);
const onUpsertForAntiDelete = antiDeleteSocket.ev.listeners('messages.upsert')[0];
const onUpdateForAntiDelete = antiDeleteSocket.ev.listeners('messages.update')[0];
async function cacheAntiDeleteMessage(id) {
  await onUpsertForAntiDelete({
    type: 'notify',
    messages: [{
      key: { remoteJid: antiDeleteGroupJid, id, participant: '628700000004@s.whatsapp.net', fromMe: false },
      message: { conversation: 'Pesan smoke test ' + id },
      pushName: 'Pengirim Smoke',
    }],
  });
}
await cacheAntiDeleteMessage('MEMBER-DELETE-SMOKE');
await onUpdateForAntiDelete([{
  key: { remoteJid: antiDeleteGroupJid, id: 'MEMBER-DELETE-SMOKE' },
  update: {
    messageStubType: WAMessageStubType.REVOKE,
    key: { remoteJid: antiDeleteGroupJid, participant: '628700000001@s.whatsapp.net', fromMe: false },
  },
}]);
assert(antiDeleteSent.length === 2, 'Anti-delete must restore a revoked message from a regular group member.');
assert(antiDeleteSent[0].payload.text.includes('@628700000001'), 'Anti-delete notice must identify the member who deleted the message.');
assert(antiDeleteSent[1].payload.forward?.key?.id === 'MEMBER-DELETE-SMOKE', 'Anti-delete must forward the original message content.');

await cacheAntiDeleteMessage('ADMIN-DELETE-SMOKE');
await onUpdateForAntiDelete([{
  key: { remoteJid: antiDeleteGroupJid, id: 'ADMIN-DELETE-SMOKE' },
  update: {
    messageStubType: WAMessageStubType.REVOKE,
    key: { remoteJid: antiDeleteGroupJid, participant: '628700000002@s.whatsapp.net', fromMe: false },
  },
}]);
assert(antiDeleteSent.length === 2, 'Anti-delete must not restore a message deleted by a group admin.');

const deletePayloads = [];
let deleteReacted = false;
const deleteContextInfo = {
  stanzaId: 'DELETE-OTHER-SMOKE',
  participant: '628700000004@s.whatsapp.net',
};
await deleteCommand.execute({
  isChannel: false,
  isGroup: true,
  chatId: antiDeleteGroupJid,
  message: { message: { extendedTextMessage: { contextInfo: deleteContextInfo } } },
  capabilities: { check: async () => ({ known: true, isAdmin: true }) },
  socket: {
    user: { id: '628700000003@s.whatsapp.net' },
    sendMessage: async (jid, payload) => {
      deletePayloads.push({ jid, payload });
      return { key: { id: 'DELETE-SMOKE' } };
    },
  },
  react: async () => { deleteReacted = true; },
});
assert(deletePayloads[0]?.payload?.delete?.id === 'DELETE-OTHER-SMOKE', 'Delete command must target the replied message ID.');
assert(deletePayloads[0]?.payload?.delete?.participant === '628700000004@s.whatsapp.net', 'Delete command must preserve the original group sender JID.');
assert(deletePayloads[0]?.payload?.delete?.fromMe === false, 'Delete command must not mislabel another member message as bot-authored.');
assert(deleteReacted, 'Delete command must confirm a successfully sent revoke request.');

const ownDeletePayloads = [];
await deleteCommand.execute({
  isChannel: false,
  isGroup: true,
  chatId: antiDeleteGroupJid,
  message: { message: { extendedTextMessage: { contextInfo: {
    stanzaId: 'DELETE-OWN-SMOKE',
    participant: '628700000003@s.whatsapp.net',
  } } } },
  capabilities: { check: async () => ({ known: true, isAdmin: false }) },
  socket: {
    user: {
      id: '123456789012345@lid',
      pn: '628700000003@s.whatsapp.net',
    },
    sendMessage: async (jid, payload) => {
      ownDeletePayloads.push({ jid, payload });
      return { key: { id: 'DELETE-OWN-SMOKE-RESULT' } };
    },
  },
  react: async () => {},
});
assert(ownDeletePayloads[0]?.payload?.delete?.id === 'DELETE-OWN-SMOKE', 'Delete command must target the bot-owned quoted message.');
assert(ownDeletePayloads[0]?.payload?.delete?.fromMe === true, 'Delete command must recognize bot-owned messages when its primary account JID is LID and quoted sender is PN.');

let deleteWithoutBotAdminRejected = false;
try {
  await deleteCommand.execute({
    isChannel: false,
    isGroup: true,
    chatId: antiDeleteGroupJid,
    message: { message: { extendedTextMessage: { contextInfo: deleteContextInfo } } },
    capabilities: { check: async () => ({ known: true, isAdmin: false }) },
    socket: { sendMessage: async () => { throw new Error('Delete must not be sent by a non-admin bot.'); } },
    react: async () => {},
  });
} catch (error) {
  deleteWithoutBotAdminRejected = String(error?.message ?? '').startsWith('USER_INPUT:')
    && String(error?.message ?? '').includes('Bot belum menjadi admin');
}
assert(deleteWithoutBotAdminRejected, 'Delete command must explain that the bot needs group admin rights.');




assert(groupMessages.flatMap((item) => item.mentions).includes('104000000000@lid'), 'Tagall must use the participant JID when WhatsApp uses LID addressing.');
assert(groupMessages[0].text.includes('@628333333333'), 'Tagall must render the visible phone number when a participant has a PN mapping.');


for (const required of ['menu', 'allmenu', 'helper', 'help', 'ping', 'info', 'owner', 'coin', 'limit', 'daily', 'limitshop', 'economystats', 'sticker', 'brat', 'bratvid', 'brathd', 'iqc', 'smeme', 'stickerwatermark', 'tomp3', 'tomp4', 'toimg', 'tovideo', 'tovn', 'texttoqr', 'hd', 'removebg', 'warn', 'unwarn', 'delete', 'pinterest', 'twitter', 'mediafire', 'gdrive', 'ttmp3', 'ytmp3', 'igmp3', 'fakecall', 'fakewachannel', 'fakettcomment', 'mockwallet', 'trivia', 'benarsalah', 'quizcepat', 'susunkata', 'tebakkata', 'tebakangka', 'tebakemoji', 'rps']) assert(visibleNames.has(required), `Missing visible command: ${required}`);
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
assert(typeof providers.sairiHostMakers?.fakeCall === 'function' && typeof providers.sairiHostMakers?.fakeChannel === 'function' && typeof providers.sairiHostMakers?.fakeTikTokComment === 'function', 'SairiHost maker API methods are missing.');
assert(typeof providers.berakNewMakers?.fakeDana === 'function', 'BerakNew fake-DANA API method is missing.');

const nativeFetchForMakerSmoke = globalThis.fetch;
let capturedFakeCallUrl = null;
const fakePngForMakerSmoke = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);
globalThis.fetch = async (input) => {
  capturedFakeCallUrl = new URL(String(input));
  return new Response(fakePngForMakerSmoke, { status: 200, headers: { 'content-type': 'image/png' } });
};
try {
  const fakeCallProvider = createSairiHostMakerProvider({
    baseUrl: 'https://api.sairihost.com',
    apiKey: 'smoke-test-key',
  });
  const fakeCallResult = await fakeCallProvider.fakeCall('SkyVerse Smoke', '00:12');
  assert(fakeCallResult.mimetype === 'image/png', 'Fakecall provider must return the downloaded image.');
} finally {
  globalThis.fetch = nativeFetchForMakerSmoke;
}
assert(capturedFakeCallUrl?.pathname === '/api/maker/fakecall', 'Fakecall provider endpoint mismatch.');
assert(capturedFakeCallUrl?.searchParams.get('duration') === '00:12', 'Fakecall API must receive the documented duration parameter.');
assert(!capturedFakeCallUrl?.searchParams.has('durasi'), 'Fakecall API must not receive the undocumented durasi parameter.');

for (const name of ['fakefbcomment', 'fakettprofile', 'fakewagroup']) assert(registry.resolve(name) === undefined, `Maker command without a matching API must stay disabled: ${name}`);
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

const mediaSmokeImage = await readFile(new URL('../../assets/SkyLabs_banner.jpg', import.meta.url));
const smemeOutput = await media.toSmeme(mediaSmokeImage, { top: 'SKYVERSE SMOKE', bottom: 'MEDIA TEST' });
assert(smemeOutput.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])), 'smeme must produce a valid JPEG image.');
const bratVidOutput = await media.toAnimatedStickerFromFrames([mediaSmokeImage, mediaSmokeImage]);
assert(
  bratVidOutput.subarray(0, 4).toString('ascii') === 'RIFF'
    && bratVidOutput.subarray(8, 12).toString('ascii') === 'WEBP'
    && bratVidOutput.includes(Buffer.from('ANMF')),
  'BratVid must produce an animated WebP with frame data.',
);

assert(typeof downloadResolvedMedia === 'function', 'Central media downloader export is missing.');
assert(typeof resolveMediaTarget === 'function', 'Media target resolver export is missing.');
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
const completedMiniSession = getMiniGame('mini-game-smoke', 'mini-chat-smoke');
assert(completedMiniSession?.players.get('mini-game-smoke')?.finished === true, 'Completed player was not marked as finished.');
assert(completedMiniSession?.type === 'tebakangka', 'Mini-game session must remain available for other participants.');
const secondPlayerWin = answerMiniGame('mini-game-smoke-2', 'mini-chat-smoke', 'MINI-GAME-1', '12');
assert(secondPlayerWin.matched && secondPlayerWin.complete, 'Another participant could not complete the active mini-game.');
stopMiniGame('mini-game-smoke-2', 'mini-chat-smoke');
assert(getMiniGame('mini-game-smoke', 'mini-chat-smoke') === null, 'Stopped mini-game session was not removed.');

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
