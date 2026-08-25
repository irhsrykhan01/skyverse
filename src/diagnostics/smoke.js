import { createCommandRegistry } from '../commands/registry.js';
import { loadConfig } from '../config/env.js';
import { createProviderManager } from '../services/providers/manager.js';
import * as media from '../services/media/index.js';
import { downloadResolvedMedia, resolveMediaTarget } from '../services/media/resolver.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const config = loadConfig({});
const registry = await createCommandRegistry();
const providers = createProviderManager(config);

const visibleCommands = registry.all({ includeHidden: false });
const visibleNames = new Set(visibleCommands.map((command) => command.name));

for (const required of [
  'menu', 'help', 'ping', 'info', 'owner',
  'sticker', 'smeme', 'stickerwatermark',
  'tomp3', 'tomp4', 'toimg', 'tovideo', 'tovn',
  'texttoqr', 'hd', 'removebg',
  'warn', 'unwarn', 'warnings', 'delete',
]) {
  assert(visibleNames.has(required), `Missing visible command: ${required}`);
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

// Regression test: a received WhatsApp Video Note is represented as ptvMessage.
// The resolver must recognize it as video and preserve the PTV flag before the
// command layer tries to upload it elsewhere.
const syntheticPtv = {
  key: { remoteJid: '120000000000000@g.us', id: 'PTV-SMOKE', fromMe: false },
  message: {
    extendedTextMessage: {
      contextInfo: {
        stanzaId: 'PTV-QUOTED',
        participant: '116000000000000@lid',
        quotedMessage: {
          ptvMessage: {
            url: 'https://example.invalid/ptv.mp4',
            mimetype: 'video/mp4',
            fileLength: 12345,
          },
        },
      },
    },
  },
};

const ptvDescriptor = resolveMediaTarget(syntheticPtv);
assert(ptvDescriptor?.type === 'video', 'PTV regression: ptvMessage was not classified as video.');
assert(ptvDescriptor?.isPTV === true, 'PTV regression: isPTV flag was not preserved.');
assert(ptvDescriptor?.message?.message?.videoMessage, 'PTV regression: ptvMessage was not normalized for downloadMediaMessage.');

console.log(`SkyVerse smoke test passed: ${visibleCommands.length} visible commands + PTV resolver regression test.`);
