import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  getTikTokStickerLibrary,
  TIKTOK_STICKER_CACHE_DIR,
} from '../../services/tiktok/sticker-collector.js';

const MAX_STATIC_BYTES = 100 * 1024;
const MAX_ANIMATED_BYTES = 500 * 1024;

function isWebp(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 20
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    && buffer.readUInt32LE(4) + 8 === buffer.length;
}

function isAnimatedWebp(buffer) {
  if (!isWebp(buffer)) return false;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > buffer.length) return false;
    if (type === 'ANIM' || type === 'ANMF') return true;
    if (type === 'VP8X' && size >= 1 && (buffer[dataStart] & 0x02)) return true;
    offset = dataEnd + (size & 1);
  }
  return false;
}

function isGif(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 6
    && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString('ascii'));
}

function isMp4(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 12
    && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
}

function pickPopularRandom(items) {
  const weights = items.map((item) => {
    const occurrences = Math.max(0, Number(item.occurrences) || 0);
    const likes = Math.max(0, Number(item.likes) || 0);
    return 1 + Math.min(10, occurrences) * 2 + Math.min(6, Math.log10(likes + 1));
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let target = Math.random() * totalWeight;

  for (let index = 0; index < items.length; index += 1) {
    target -= weights[index];
    if (target < 0) return items[index];
  }
  return items[items.length - 1];
}

async function sendCachedSticker(ctx, item) {
  const filename = basename(String(item.file ?? ''));
  if (!filename || filename !== item.file) {
    throw new Error('File cache stiker tidak valid.');
  }

  const buffer = await readFile(join(TIKTOK_STICKER_CACHE_DIR, filename));
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) {
    throw new Error('File stiker di cache kosong atau rusak.');
  }

  const animated = Boolean(item.animated)
    || isAnimatedWebp(buffer)
    || isGif(buffer)
    || isMp4(buffer);

  let output;
  if (animated && isAnimatedWebp(buffer) && buffer.length <= MAX_ANIMATED_BYTES) {
    output = buffer;
  } else if (animated) {
    output = await ctx.media.toAnimatedSticker(buffer);
  } else {
    output = await ctx.media.toSticker(buffer);
  }

  if (animated && output.length > MAX_ANIMATED_BYTES) {
    throw new Error('Stiker animasi melebihi batas WhatsApp 500 KB setelah diproses.');
  }
  if (!animated && output.length > MAX_STATIC_BYTES) {
    throw new Error('Stiker gambar melebihi batas WhatsApp 100 KB setelah diproses.');
  }

  await ctx.media.send(output, 'sticker');
}

function emptyLibraryMessage(result) {
  const stats = result.stats ?? {};
  if (Number(stats.stickerComments ?? 0) > 0 && Number(stats.assetUrls ?? 0) === 0) {
    return [
      '⚠️ TikTok menemukan komentar stiker, tetapi data publiknya belum menyediakan URL file gambar/animasi.',
      'Koleksi belum bisa diisi. Ini batasan data publik TikTok, bukan error WhatsApp.',
    ].join('\n');
  }

  const detail = result.lastError ? '\nDetail: ' + result.lastError : '';
  return '⚠️ Belum ada stiker TikTok yang berhasil masuk ke koleksi SkyVerse.'
    + detail
    + '\nCoba lagi beberapa saat nanti.';
}

export const command = {
  name: 'stikertiktok',
  description: 'Mengirim satu stiker TikTok populer secara acak dari koleksi SkyVerse.',
  category: 'sticker',
  aliases: [],
  usage: 'stikertiktok',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 4000,
  async execute(ctx) {
    await ctx.react('⏳');

    // The collector refreshes only when its six-hour cache is stale.
    const result = await getTikTokStickerLibrary();
    const items = result.items ?? [];

    if (!items.length) {
      await ctx.reply(emptyLibraryMessage(result));
      return;
    }

    const selected = pickPopularRandom(items);
    await sendCachedSticker(ctx, selected);
  },
};
