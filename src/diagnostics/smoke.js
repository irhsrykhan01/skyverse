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

const commands = registry.all({ includeHidden: true });
const names = new Set(commands.map((command) => command.name));

for (const required of ['menu', 'help', 'ping', 'info', 'owner', 'sticker', 'tomp3', 'tomp4', 'tovideo', 'tovn']) {
  assert(names.has(required), `Missing command: ${required}`);
}

assert(!names.has('qc'), 'Disabled command qc is still registered.');
assert(typeof providers.depay?.brat === 'function', 'Depay provider is missing brat().');
assert(typeof providers.depay?.iqc === 'function', 'Depay provider is missing iqc().');
assert(typeof providers.downloader?.tiktok === 'function', 'Keyra TikTok provider is missing.');
assert(typeof providers.downloader?.youtube === 'function', 'Keyra YouTube provider is missing.');
assert(typeof media.toMp3 === 'function', 'Media toMp3 export is missing.');
assert(typeof media.toVideo === 'function', 'Media toVideo export is missing.');
assert(typeof media.toVoiceNote === 'function', 'Media toVoiceNote export is missing.');

console.log(`SkyVerse smoke test passed: ${commands.length} registered commands.`);
