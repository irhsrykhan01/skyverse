import { createCommandRegistry } from '../commands/registry.js';
import { loadConfig } from '../config/env.js';
import { createProviderManager } from '../services/providers/manager.js';
import * as media from '../services/media/index.js';

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

console.log(`SkyVerse smoke test passed: ${visibleCommands.length} visible commands.`);
