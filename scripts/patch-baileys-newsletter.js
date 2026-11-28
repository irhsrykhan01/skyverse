import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = path.join(root, 'node_modules', '@whiskeysockets', 'baileys', 'lib');

function read(relative) {
  const file = path.join(lib, relative);
  if (!fs.existsSync(file)) throw new Error(`[SkyVerse] Baileys file missing: ${relative}`);
  return { file, text: fs.readFileSync(file, 'utf8') };
}

function replaceRequired(source, pattern, replacement, label) {
  if (typeof pattern === 'string') {
    if (source.includes(replacement)) return source;
    if (!source.includes(pattern)) throw new Error(`[SkyVerse] Cannot patch Baileys: ${label} pattern not found.`);
    return source.replace(pattern, replacement);
  }
  if (pattern.test(source) && replacement.test && replacement.test(source)) return source;
  if (!pattern.test(source)) throw new Error(`[SkyVerse] Cannot patch Baileys: ${label} pattern not found.`);
  return source.replace(pattern, replacement);
}

function write(relative, transform) {
  const item = read(relative);
  const next = transform(item.text);
  if (next !== item.text) fs.writeFileSync(item.file, next, 'utf8');
}

write('Defaults/index.js', (source) => {
  if (source.includes('NEWSLETTER_MEDIA_PATH_MAP')) return source;
  const marker = 'export const MEDIA_HKDF_KEY_MAPPING = {';
  if (!source.includes(marker)) throw new Error('[SkyVerse] Baileys defaults layout is unsupported.');
  return source.replace(marker, `export const NEWSLETTER_MEDIA_PATH_MAP = {
  image: '/newsletter/newsletter-image',
  video: '/newsletter/newsletter-video',
  document: '/newsletter/newsletter-document',
  audio: '/newsletter/newsletter-audio',
  sticker: '/newsletter/newsletter-image',
  'thumbnail-link': '/newsletter/newsletter-thumbnail-link'
};
${marker}`);
});

write('Utils/messages-media.js', (source) => {
  if (!source.includes('NEWSLETTER_MEDIA_PATH_MAP')) {
    source = replaceRequired(
      source,
      "import { DEFAULT_ORIGIN, MEDIA_HKDF_KEY_MAPPING, MEDIA_PATH_MAP } from '../Defaults/index.js';",
      "import { DEFAULT_ORIGIN, MEDIA_HKDF_KEY_MAPPING, MEDIA_PATH_MAP, NEWSLETTER_MEDIA_PATH_MAP } from '../Defaults/index.js';",
      'newsletter media path import'
    );
  }
  if (!source.includes('timeoutMs, newsletter')) {
    source = replaceRequired(
      source,
      'return async (filePath, { mediaType, fileEncSha256B64, timeoutMs }) => {',
      'return async (filePath, { mediaType, fileEncSha256B64, timeoutMs, newsletter }) => {',
      'newsletter upload flag'
    );
  }
  if (!source.includes('server_thumb_gen=1')) {
    source = replaceRequired(
      source,
      'const url = `https://${hostname}${MEDIA_PATH_MAP[mediaType]}/${fileEncSha256B64}?auth=${auth}&token=${fileEncSha256B64}`;',
      "const mediaPathMap = newsletter ? NEWSLETTER_MEDIA_PATH_MAP : MEDIA_PATH_MAP;\n                const serverThumb = newsletter ? '&server_thumb_gen=1' : '';\n                const url = `https://${hostname}${mediaPathMap[mediaType]}/${fileEncSha256B64}?auth=${auth}&token=${fileEncSha256B64}${serverThumb}`;",
      'newsletter CDN upload URL'
    );
  }
  if (!source.includes('thumbnailDirectPath: result.thumbnail_direct_path')) {
    source = replaceRequired(
      source,
      'ts: result.ts',
      'ts: result.ts,\n                            thumbnailDirectPath: result.thumbnail_direct_path,\n                            thumbnailSha256: result.thumbnail_sha256',
      'newsletter thumbnail upload metadata'
    );
  }
  return source;
});

write('Utils/messages.js', (source) => {
  if (!source.includes('const isNewsletter = !!options.jid && isJidNewsletter(options.jid)')) {
    throw new Error('[SkyVerse] Baileys newsletter preparation branch is missing.');
  }
  const declaration = 'const isNewsletter = !!options.jid && isJidNewsletter(options.jid);';
  if (!source.includes("mediaType + ':' + (isNewsletter ? 'newsletter:' : 'normal:')")) {
    source = source.replace(
      'const cacheableKey = typeof uploadData.media === \'object\' &&',
      `${declaration}\n    const cacheableKey = typeof uploadData.media === 'object' &&`
    );
    const first = source.indexOf(declaration);
    const second = source.indexOf(declaration, first + declaration.length);
    if (second !== -1) source = source.slice(0, second) + source.slice(second + declaration.length);
    source = replaceRequired(
      source,
      "mediaType + ':' + uploadData.media.url.toString();",
      "mediaType + ':' + (isNewsletter ? 'newsletter:' : 'normal:') + uploadData.media.url.toString();",
      'newsletter-specific media cache key'
    );
  }
  if (!source.includes('newsletter: isNewsletter')) {
    source = replaceRequired(
      source,
      'const { mediaUrl, directPath } = await options.upload(filePath, {',
      'const { mediaUrl, directPath, thumbnailDirectPath, thumbnailSha256 } = await options.upload(filePath, {',
      'newsletter upload response fields'
    );
    source = replaceRequired(
      source,
      /timeoutMs: options\.mediaUploadTimeoutMs\s*\n\s*\}\);/,
      'timeoutMs: options.mediaUploadTimeoutMs,\n            newsletter: isNewsletter\n        });',
      'newsletter upload mode'
    );
  }
  if (!source.includes('directPath,\n                thumbnailDirectPath,\n                thumbnailSha256')) {
    source = replaceRequired(
      source,
      'url: mediaUrl,\n                directPath,\n                fileSha256,',
      'url: isNewsletter ? null : mediaUrl,\n                directPath,\n                thumbnailDirectPath,\n                thumbnailSha256,\n                fileSha256,',
      'newsletter thumbnail message fields'
    );
  }
  return source;
});

write('Socket/messages-send.js', (source) => {
  if (!source.includes("tag: 'plaintext',\n                    attrs: extraAttrs,")) {
    source = replaceRequired(
      source,
      /tag: 'plaintext',\s*attrs: \{\},\s*content: bytes/,
      "tag: 'plaintext',\n                    attrs: extraAttrs,\n                    content: bytes",
      'newsletter plaintext media attributes'
    );
  }
  if (!source.includes('SOUND_STICKER_FIELD_134')) {
    const marker = 'export const makeMessagesSocket =';
    if (!source.includes(marker)) throw new Error('[SkyVerse] Baileys message socket layout is unsupported.');
    source = source.replace(marker, "// SOUND_STICKER_FIELD_134: encode the WhatsApp sound-sticker envelope for Channels.\nfunction encodeSoundStickerVarint(value) {\n  let number = Number(value);\n  const bytes = [];\n  while (number > 127) { bytes.push((number & 127) | 128); number = Math.floor(number / 128); }\n  bytes.push(number);\n  return Buffer.from(bytes);\n}\nfunction encodeSoundStickerBytes(fieldNumber, value) {\n  const data = Buffer.from(value);\n  return Buffer.concat([encodeSoundStickerVarint(fieldNumber * 8 + 2), encodeSoundStickerVarint(data.length), data]);\n}\nfunction encodeSoundStickerNewsletterMessage(message) {\n  const sticker = message?.stickerMessage;\n  if (!sticker?.audioMessage) return encodeNewsletterMessage(message);\n  const { audioMessage, stickerEmoji, ...stickerFields } = sticker;\n  const { stickerMessage: _ignoredSticker, ...baseMessage } = message;\n  const baseBytes = Buffer.from(proto.Message.encode(baseMessage).finish());\n  const stickerBytes = Buffer.from(proto.Message.StickerMessage.encode(stickerFields).finish());\n  const audioBytes = Buffer.from(proto.Message.AudioMessage.encode(audioMessage).finish());\n  const parts = [stickerBytes, Buffer.from([0xc0, 0x01, 0x00])];\n  if (typeof stickerEmoji === 'string' && stickerEmoji.length) parts.push(encodeSoundStickerBytes(25, Buffer.from(stickerEmoji, 'utf8')));\n  parts.push(encodeSoundStickerBytes(26, audioBytes));\n  const nestedSticker = encodeSoundStickerBytes(26, Buffer.concat(parts));\n  const futureProofMessage = encodeSoundStickerBytes(1, nestedSticker);\n  const soundStickerField = encodeSoundStickerBytes(134, futureProofMessage);\n  return Buffer.concat([baseBytes, soundStickerField]);\n}" + '\n\n' + marker);
  }
  if (!source.includes('encodeSoundStickerNewsletterMessage(patched)')) {
    source = replaceRequired(
      source,
      'const bytes = encodeNewsletterMessage(patched);',
      'const bytes = encodeSoundStickerNewsletterMessage(patched);',
      'newsletter sound-sticker protobuf envelope'
    );
  }
  return source;
});

console.log('[SkyVerse] Baileys newsletter media transport patch applied.');
