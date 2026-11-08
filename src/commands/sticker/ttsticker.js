import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  getTikTokStickerLibrary,
  refreshTikTokStickerLibrary,
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
  return Buffer.isBuffer(buffer) && buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString('ascii'));
}

function isMp4(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
}

function emptyMessage(result) {
  const stats = result.stats ?? {};
  if (Number(stats.stickerComments ?? 0) > 0 && Number(stats.assetUrls ?? 0) === 0) {
    return [
      '⚠️ TikTok menemukan ' + stats.stickerComments + ' komentar bertanda [Sticker], tetapi data publiknya tidak menyertakan URL file gambar/animasi.',
      'Jadi bot belum bisa mengambil stikernya secara langsung. Ini batasan data dari TikTok, bukan error Baileys.',
      result.lastError ? 'Detail: ' + result.lastError : '',
    ].filter(Boolean).join('\n');
  }
  if (result.lastError) {
    return '⚠️ Koleksi stiker TikTok belum bisa diperbarui.\nDetail: ' + result.lastError;
  }
  return 'Belum ada file stiker TikTok yang berhasil dikumpulkan. Collector akan mencoba lagi pada pembaruan berikutnya.';
}

async function sendCachedSticker(ctx, item) {
  const filename = basename(String(item.file ?? ''));
  if (!filename || filename !== item.file) throw new Error('File cache stiker tidak valid.');

  const buffer = await readFile(join(TIKTOK_STICKER_CACHE_DIR, filename));
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new Error('File stiker di cache kosong atau rusak.');

  const animated = Boolean(item.animated) || isAnimatedWebp(buffer) || isGif(buffer) || isMp4(buffer);
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

function buildLibraryMessage(result) {
  const items = result.items ?? [];
  const lines = [
    '╭─「 TIKTOK STICKER 」',
    '│ Koleksi publik yang berhasil di-cache',
    '│ Total: ' + items.length + ' stiker',
    '╰────────────────',
  ];

  items.slice(0, 15).forEach((item, index) => {
    const type = item.animated ? 'GIF' : 'GAMBAR';
    const uses = Number(item.occurrences ?? 0);
    lines.push((index + 1) + '. [' + type + '] • terdeteksi ' + uses + 'x');
  });

  lines.push('', 'Kirim: .ttsticker 1');
  lines.push('Acak: .ttsticker random');
  lines.push('Perbarui: .ttsticker refresh');
  return lines.join('\n');
}

export const command = {
  name: 'ttsticker',
  description: 'Mengambil stiker komentar TikTok publik yang tersedia dan mengirimkannya sebagai stiker WhatsApp.',
  category: 'sticker',
  aliases: [],
  usage: 'ttsticker [nomor|random|refresh]',
  permission: 'user',
  minArgs: 0,
  maxArgs: 1,
  cooldown: 4000,
  async execute(ctx) {
    const action = String(ctx.parsed.args[0] ?? 'list').trim().toLowerCase();

    if (['refresh', 'update', 'scan'].includes(action)) {
      await ctx.react('🔄');
      const result = await refreshTikTokStickerLibrary();
      const count = (result.items ?? []).length;
      if (count > 0) {
        await ctx.reply('✅ Koleksi diperbarui. Cache sekarang berisi ' + count + ' stiker.');
      } else {
        await ctx.reply(emptyMessage(result));
      }
      return;
    }

    const result = await getTikTokStickerLibrary({ refreshIfStale: true });
    const items = result.items ?? [];

    if (!items.length) {
      await ctx.reply(emptyMessage(result));
      return;
    }

    if (action === 'list' || action === 'trending' || action === 'latest') {
      await ctx.reply(buildLibraryMessage(result));
      return;
    }

    let selected;
    if (action === 'random' || action === 'acak') {
      selected = items[Math.floor(Math.random() * items.length)];
    } else if (/^\d+$/.test(action)) {
      const index = Number(action);
      if (index < 1 || index > items.length) {
        throw new Error('Nomor stiker tidak tersedia. Gunakan .ttsticker untuk melihat daftar.');
      }
      selected = items[index - 1];
    } else {
      throw new Error('Pilihan tidak dikenal. Gunakan .ttsticker, .ttsticker random, atau .ttsticker refresh.');
    }

    await ctx.react('⏳');
    await sendCachedSticker(ctx, selected);
  },
};
