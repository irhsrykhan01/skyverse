import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = path.join(root, 'node_modules', '@whiskeysockets', 'baileys', 'lib');
const required = ['Defaults/index.js', 'Utils/messages-media.js', 'Utils/messages.js', 'Socket/messages-send.js'];
const missing = required.filter((file) => !fs.existsSync(path.join(lib, file)));

if (missing.length) {
  console.error('[SkyVerse] Newsletter check failed; missing Baileys files:');
  console.error(missing.join('\n'));
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(lib, '..', 'package.json'), 'utf8'));
const defaults = fs.readFileSync(path.join(lib, 'Defaults/index.js'), 'utf8');
const media = fs.readFileSync(path.join(lib, 'Utils/messages-media.js'), 'utf8');
const messages = fs.readFileSync(path.join(lib, 'Utils/messages.js'), 'utf8');
const send = fs.readFileSync(path.join(lib, 'Socket/messages-send.js'), 'utf8');

const checks = {
  'newsletter CDN map': defaults.includes('NEWSLETTER_MEDIA_PATH_MAP'),
  'newsletter upload endpoint': media.includes('server_thumb_gen=1') && media.includes('NEWSLETTER_MEDIA_PATH_MAP'),
  'newsletter raw media metadata': messages.includes('newsletter: isNewsletter') &&
    messages.includes('thumbnailDirectPath') && messages.includes('url: isNewsletter ? null : mediaUrl'),
  'newsletter plaintext media attributes': /tag: 'plaintext',[\s\S]{0,100}attrs: extraAttrs/.test(send),
};

console.log(`[SkyVerse] Baileys version: ${pkg.version ?? 'unknown'}`);
for (const [label, ok] of Object.entries(checks)) {
  console.log(`[SkyVerse] ${label}: ${ok ? 'OK' : 'MISSING'}`);
}

if (Object.values(checks).some((ok) => !ok)) {
  console.error('[SkyVerse] Run npm start so the prestart patch can apply, then run npm run check-newsletter.');
  process.exit(1);
}

console.log('[SkyVerse] Newsletter transport patch is installed. Live Channel posting still needs a WhatsApp test.');
