import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const baileysRoot = path.join(root, 'node_modules', '@whiskeysockets', 'baileys', 'lib');
const required = [
  'Defaults/index.js',
  'Utils/messages-media.js',
  'Utils/messages.js',
  'Socket/messages-send.js',
];

const missing = required.filter((file) => !fs.existsSync(path.join(baileysRoot, file)));
if (missing.length) {
  console.error('[SkyVerse] Baileys newsletter check failed: missing compiled files.');
  console.error(missing.join('\n'));
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(baileysRoot, '..', 'package.json'), 'utf8'));
const version = packageJson.version ?? 'unknown';

const defaults = fs.readFileSync(path.join(baileysRoot, 'Defaults/index.js'), 'utf8');
const messagesMedia = fs.readFileSync(path.join(baileysRoot, 'Utils/messages-media.js'), 'utf8');
const messages = fs.readFileSync(path.join(baileysRoot, 'Utils/messages.js'), 'utf8');
const send = fs.readFileSync(path.join(baileysRoot, 'Socket/messages-send.js'), 'utf8');

const hasNewsletterMap = defaults.includes('NEWSLETTER_MEDIA_PATH_MAP');
const hasNewsletterUploadFlag = messagesMedia.includes('newsletter');
const hasNewsletterPreparation = messages.includes('isJidNewsletter') && messages.includes('getRawMediaUploadData');
const hasNewsletterPlaintextAttrs = send.includes('mediatype') || send.includes('extraAttrs');

console.log(`[SkyVerse] Baileys version: ${version}`);
console.log(`[SkyVerse] newsletter media map: ${hasNewsletterMap ? 'present' : 'missing'}`);
console.log(`[SkyVerse] newsletter upload branch: ${hasNewsletterUploadFlag ? 'present' : 'missing'}`);
console.log(`[SkyVerse] newsletter raw-media preparation: ${hasNewsletterPreparation ? 'present' : 'missing'}`);
console.log(`[SkyVerse] newsletter plaintext media attributes: ${hasNewsletterPlaintextAttrs ? 'present' : 'missing'}`);

if (!hasNewsletterPreparation) {
  console.error('[SkyVerse] This Baileys build does not expose the newsletter raw-media preparation path expected by upch.');
  process.exit(1);
}

if (!hasNewsletterMap || !hasNewsletterUploadFlag || !hasNewsletterPlaintextAttrs) {
  console.warn('[SkyVerse] Newsletter media transport is not fully patched in this installed Baileys build.');
  console.warn('[SkyVerse] Keep channel PTV testing disabled until the transport patch is applied.');
  process.exit(2);
}

console.log('[SkyVerse] Newsletter media transport looks compatible for channel-media testing.');
