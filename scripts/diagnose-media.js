import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as media from '../src/services/media/index.js';

const root = process.cwd();
const imagePath = join(root, 'assets', 'SkyLabs_banner.jpg');
const tempDir = await mkdtemp(join(tmpdir(), 'skyverse-media-diagnostic-'));
const failures = [];\nlet passed = 0;\nlet skipped = 0;

function run(command, args, timeout = 60_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error(command + ' melewati batas waktu.'));
    }, timeout);
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-5000); });
    child.once('error', (error) => finish(new Error(command + ' tidak tersedia: ' + error.message)));
    child.once('close', (code, signal) => {
      if (code === 0) return finish();
      finish(new Error(command + ' gagal (' + (code ?? signal) + '): ' + (stderr.trim() || 'tidak ada detail error')));
    });
  });
}

function isJpeg(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 16
    && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isWebp(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 20
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
    const end = offset + 8 + size;
    if (end > buffer.length) return false;
    if (type === 'ANMF') return true;
    offset = end + (size & 1);
  }
  return false;
}

function isMp4(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 16
    && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
}

function isMp3(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 1024
    && (buffer.subarray(0, 3).toString('ascii') === 'ID3'
      || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0));
}

function isOgg(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 16
    && buffer.subarray(0, 4).toString('ascii') === 'OggS';
}

async function check(label, operation, validate, detail) {
  try {
    const output = await operation();
    if (!validate(output)) throw new Error(detail ?? 'format output tidak valid atau kosong');
    passed += 1;\n    console.log('[OK] ' + label + (Buffer.isBuffer(output) ? ' — ' + output.length + ' bytes' : ''));
    return output;
  } catch (error) {
    failures.push(label + ': ' + String(error?.message ?? error).replace(/\\s+/g, ' ').slice(0, 300));
    console.log('[FAIL] ' + label + ' — ' + failures.at(-1).slice(label.length + 2));
    return null;
  }
}

let animatedSticker = null;
try {
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=880:duration=2',
    '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2',
    join(tempDir, 'sample.wav'),
  ]);
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-loop', '1', '-framerate', '15', '-i', imagePath,
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
    '-t', '2', '-shortest',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart',
    join(tempDir, 'sample.mp4'),
  ]);

  const image = await readFile(imagePath);
  const wav = await readFile(join(tempDir, 'sample.wav'));
  const video = await readFile(join(tempDir, 'sample.mp4'));

  const sticker = await check('toSticker (gambar → WebP)', () => media.toSticker(image), isWebp, 'hasil bukan WebP RIFF yang valid');
  if (sticker) {
    await check('toImage (WebP → JPEG)', () => media.toImage(sticker), isJpeg, 'hasil bukan JPEG yang valid');
  }

  const animated = await check(
    'toAnimatedStickerFromFrames (frame → WebP animasi)',
    () => media.toAnimatedStickerFromFrames([image, image]),
    isAnimatedWebp,
    'hasil tidak memiliki frame animasi WebP',
  );
  animatedSticker = animated;

  await check('toMp3 (audio → MP3)', () => media.toMp3(wav), isMp3, 'hasil bukan MP3 yang valid');
  await check('toMp3 (video → MP3)', () => media.toMp3(video), isMp3, 'hasil bukan MP3 yang valid');
  await check('toMp4 (gambar → MP4)', () => media.toMp4(image, { sourceType: 'image' }), isMp4, 'hasil bukan MP4 yang valid');
  await check('toMp4 (video → MP4)', () => media.toMp4(video, { sourceType: 'video' }), isMp4, 'hasil bukan MP4 yang valid');

  await check('toVoiceNote (audio → OGG/Opus)', () => media.toVoiceNote(wav), isOgg, 'hasil bukan kontainer OGG yang valid');
  await check('toHd (gambar → JPEG HD)', () => media.toHd(image), isJpeg, 'hasil bukan JPEG yang valid');
  await check('toSmeme (gambar + teks → JPEG)', () => media.toSmeme(image, { top: 'SKYVERSE TEST', bottom: 'MEDIA OK' }), isJpeg, 'hasil bukan JPEG yang valid');
  await check('toStickerWatermark (gambar → WebP)', () => media.toStickerWatermark(image), isWebp, 'hasil bukan WebP RIFF yang valid');
  await check('toAnimatedSticker (video → WebP animasi)', () => media.toAnimatedSticker(video), isAnimatedWebp, 'hasil tidak memiliki frame animasi WebP');

  if (animatedSticker) {
    await check(
      'toVideo (WebP animasi → MP4)',
      () => media.toVideo(animatedSticker, { sourceType: 'sticker', animated: true }),
      isMp4,
      'hasil bukan MP4 yang valid',
    );
    await check('toImage (WebP animasi → frame JPEG)', () => media.toImage(animatedSticker), isJpeg, 'hasil bukan JPEG yang valid');
  } else {
    failures.push('toVideo: dilewati karena WebP animasi gagal dibuat');
    console.log('[SKIP] toVideo — WebP animasi tidak tersedia');
  }
} catch (error) {
  failures.push('Persiapan fixture: ' + String(error?.message ?? error).replace(/\\s+/g, ' ').slice(0, 300));
  console.log('[FAIL] Persiapan fixture — ' + failures.at(-1));
} finally {
  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
}

console.log('');
console.log('Media diagnostics: ' + passed + ' passed, ' + skipped + ' skipped, ' + failures.length + ' failed.');
if (failures.length) {
  console.error(failures.map((item) => '- ' + item).join('\\n'));
  process.exitCode = 1;
}
