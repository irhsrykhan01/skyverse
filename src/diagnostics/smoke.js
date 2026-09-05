import { createCommandRegistry } from '../commands/registry.js';
import { loadConfig } from '../config/env.js';
import { createProviderManager } from '../services/providers/manager.js';
import * as media from '../services/media/index.js';
import { downloadResolvedMedia, resolveMediaTarget } from '../services/media/resolver.js';
import { startBombGame, getBombGame, guessBomb, stopBombGame } from '../games/bomb.js';
import { startMathQuiz, getMathQuiz, answerMathQuiz, stopMathQuiz, formatMathQuestion } from '../games/mathquiz.js';
import { economyDefaults, EconomyManager } from '../economy/manager.js';
import { createRichMessage, htmlToText } from '../platform/whatsapp/rich.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const config = loadConfig({});
const registry = await createCommandRegistry();
const providers = createProviderManager(config);
const visibleCommands = registry.all({ includeHidden: false });
const visibleNames = new Set(visibleCommands.map((command) => command.name));

for (const required of ['menu', 'help', 'ping', 'info', 'owner', 'balance', 'claim', 'sticker', 'smeme', 'stickerwatermark', 'tomp3', 'tomp4', 'toimg', 'tovideo', 'tovn', 'texttoqr', 'hd', 'removebg', 'warn', 'unwarn', 'warnings', 'delete']) {
  assert(visibleNames.has(required), `Missing visible command: ${required}`);
}
for (const command of visibleCommands) {
  assert(typeof command.execute === 'function', `Command ${command.name} has no execute().`);
  assert(['owner', 'admin', 'premium', 'npc'].includes(command.access), `Invalid access group: ${command.name}`);
  assert(Number.isInteger(command.cost) && command.cost >= 0, `Invalid coin cost: ${command.name}`);
}
assert(registry.resolve('qc') === undefined, 'Disabled command qc is still resolvable.');
assert(registry.resolve('bratvid') === undefined, 'Disabled command bratvid is still resolvable.');
assert(typeof providers.depay?.brat === 'function', 'Depay provider is missing brat().');
assert(typeof providers.depay?.iqc === 'function', 'Depay provider is missing iqc().');
assert(typeof providers.downloader?.tiktok === 'function', 'Keyra TikTok provider is missing.');
assert(typeof providers.downloader?.youtube === 'function', 'Keyra YouTube provider is missing.');
assert(typeof providers.downloader?.youtubeMp3 === 'function', 'Keyra YouTube MP3 provider is missing.');
assert(typeof media.toMp3 === 'function', 'Media toMp3 export is missing.');
assert(typeof media.toVideo === 'function', 'Media toVideo export is missing.');
assert(typeof media.toVoiceNote === 'function', 'Media toVoiceNote export is missing.');
assert(typeof media.toHd === 'function', 'Media toHd export is missing.');
assert(typeof media.toSmeme === 'function', 'Media toSmeme export is missing.');
assert(typeof media.toStickerWatermark === 'function', 'Media toStickerWatermark export is missing.');
assert(typeof downloadResolvedMedia === 'function', 'Central media downloader export is missing.');
assert(typeof resolveMediaTarget === 'function', 'Media target resolver export is missing.');

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
assert(Number.isInteger(bombSession?.bomb) && bombSession.bomb >= 1 && bombSession.bomb <= 9, 'Bomb game internal bomb contract failed.');
const bombResult = guessBomb('smoke', 0);
assert(bombResult.reason === 'invalid', 'Bomb game invalid-input contract failed.');
stopBombGame('smoke');

const mathSession = startMathQuiz('smoke');
assert(getMathQuiz('smoke')?.answer === mathSession.answer, 'Math quiz session contract failed.');
assert(formatMathQuestion(mathSession).includes('='), 'Math quiz formatter contract failed.');
const mathResult = answerMathQuiz('smoke', mathSession.answer);
assert(mathResult.ok && mathResult.result === 'win', 'Math quiz answer contract failed.');
stopMathQuiz('smoke');

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

console.log(`SkyVerse smoke test passed: ${visibleCommands.length} visible commands + economy + games + Rich + PTV resolver tests.`);
