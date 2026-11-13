import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_STATIC_STICKER_BYTES = 100 * 1024;
const MAX_ANIMATED_STICKER_BYTES = 500 * 1024;
const MAX_ANIMATED_FRAMES = 180;

const MEME_FONT_CANDIDATES = Object.freeze([
  '/system/fonts/Roboto-Bold.ttf',
  '/system/fonts/NotoSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
  '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/Library/Fonts/Arial Bold.ttf',
  'C:/Windows/Fonts/arialbd.ttf',
]);

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', (error) => reject(new Error(`${command} tidak tersedia: ${error.message}`)));
    child.once('close', (code) => {
      const out = Buffer.concat(stdout).toString();
      const err = Buffer.concat(stderr).toString().trim();
      if (code === 0) return resolve({ stdout: out, stderr: err });
      reject(new Error(`${command} gagal (${code}): ${err || out || 'unknown error'}`));
    });
  });
}

function isWebp(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 20 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP' && buffer.readUInt32LE(4) + 8 === buffer.length;
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

function countAnimatedFrames(buffer) {
  if (!isAnimatedWebp(buffer)) return 1;
  let offset = 12;
  let frames = 0;
  while (offset + 8 <= buffer.length) {
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    const size = buffer.readUInt32LE(offset + 4);
    const dataEnd = offset + 8 + size;
    if (dataEnd > buffer.length) break;
    if (type === 'ANMF') frames += 1;
    offset = dataEnd + (size & 1);
  }
  return Math.max(1, Math.min(frames, MAX_ANIMATED_FRAMES));
}

async function withTempMedia(input, outputExtension, buildArgs) {
  const dir = await mkdtemp(join(tmpdir(), 'skyverse-media-'));
  const inputPath = join(dir, 'input.bin');
  const outputPath = join(dir, `output${outputExtension}`);
  try {
    if (!Buffer.isBuffer(input) || input.length < 16) throw new Error('Input media kosong atau tidak valid.');
    await writeFile(inputPath, input);
    const args = await buildArgs(inputPath, outputPath, dir);
    await runProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args]);
    const output = await readFile(outputPath);
    if (output.length < 16) throw new Error('FFmpeg tidak menghasilkan output yang valid.');
    await runProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', outputPath, '-f', 'null', '-']);
    return output;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractAnimatedFrames(buffer, dir) {
  if (!isAnimatedWebp(buffer)) throw new Error('Input bukan sticker WebP bergerak yang valid.');
  const inputPath = join(dir, 'animated.webp');
  await writeFile(inputPath, buffer);
  const frameCount = countAnimatedFrames(buffer);
  if (frameCount < 2) throw new Error('Sticker tidak memiliki frame animasi yang cukup untuk dijadikan video.');
  const frames = [];
  for (let index = 1; index <= frameCount; index += 1) {
    const framePath = join(dir, `frame-${String(index).padStart(4, '0')}.webp`);
    await runProcess('webpmux', ['-get', 'frame', String(index), inputPath, '-o', framePath]);
    const frame = await readFile(framePath);
    if (!isWebp(frame)) throw new Error(`Frame WebP ${index} hasil ekstraksi tidak valid.`);
    frames.push(framePath);
  }
  return frames;
}

async function animatedWebpToVideo(buffer) {
  const dir = await mkdtemp(join(tmpdir(), 'skyverse-animated-webp-'));
  try {
    const frames = await extractAnimatedFrames(buffer, dir);
    const outputPath = join(dir, 'output.mp4');
    await runProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-framerate', '30', '-i', join(dir, 'frame-%04d.webp'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart', '-frames:v', String(frames.length), outputPath]);
    const output = await readFile(outputPath);
    if (output.length < 1024) throw new Error('Video hasil ekstraksi WebP kosong atau terlalu kecil.');
    await runProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', outputPath, '-f', 'null', '-']);
    return output;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function animatedWebpToFirstFrame(buffer) {
  const dir = await mkdtemp(join(tmpdir(), 'skyverse-webp-frame-'));
  try {
    const inputPath = join(dir, 'animated.webp');
    const framePath = join(dir, 'frame.webp');
    await writeFile(inputPath, buffer);
    await runProcess('webpmux', ['-get', 'frame', '1', inputPath, '-o', framePath]);
    const frame = await readFile(framePath);
    if (!isWebp(frame)) throw new Error('Frame pertama WebP tidak valid.');
    return frame;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function framesToAnimatedWebp(frames, { frameDuration = 0.4, lastFrameDuration = 3 } = {}) {
  if (!Array.isArray(frames) || frames.length < 2) throw new Error('Minimal 2 frame diperlukan untuk BratVid.');
  if (frames.length > MAX_ANIMATED_FRAMES) throw new Error(`Frame animasi terlalu banyak (maksimal ${MAX_ANIMATED_FRAMES}).`);
  const frameDelay = Math.max(0.04, Math.min(3, Number(frameDuration) || 0.4));
  const finalFrameDelay = Math.max(0.04, Math.min(3, Number(lastFrameDuration) || 3));

  const dir = await mkdtemp(join(tmpdir(), 'skyverse-bratvid-'));
  try {
    const framePaths = [];
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index];
      if (!Buffer.isBuffer(frame) || frame.length < 16) throw new Error(`Frame ${index + 1} tidak valid.`);
      const sourcePath = join(dir, `source-${String(index + 1).padStart(4, '0')}.bin`);
      const framePath = join(dir, `frame-${String(index + 1).padStart(4, '0')}.png`);
      await writeFile(sourcePath, frame);
      await runProcess('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
        '-i', sourcePath,
        '-frames:v', '1',
        '-vf', `${scaleFilter()},format=rgba`,
        '-c:v', 'png', '-f', 'image2', framePath,
      ]);
      const normalized = await readFile(framePath);
      if (normalized.length < 16 || !normalized.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        throw new Error(`Frame ${index + 1} gagal dinormalisasi menjadi PNG.`);
      }
      framePaths.push(framePath);
    }

    const escapeConcatPath = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const lastFrame = framePaths[framePaths.length - 1];
    const concatEntries = framePaths.map((framePath) => `file '${escapeConcatPath(framePath)}'\nduration ${frameDelay}`);
    concatEntries.push(`file '${escapeConcatPath(lastFrame)}'\nduration ${finalFrameDelay}`);
    const concatPath = join(dir, 'frames.txt');
    await writeFile(concatPath, `${concatEntries.join('\n')}\n`);

    const outputPath = join(dir, 'bratvid.webp');
    await runProcess('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-vsync', 'vfr',
      '-vf', 'format=rgba',
      '-c:v', 'libwebp', '-lossless', '0', '-q:v', '55',
      '-compression_level', '6', '-pix_fmt', 'yuva420p',
      '-loop', '0', '-an', '-f', 'webp', outputPath,
    ]);

    const output = await readFile(outputPath);
    if (!isAnimatedWebp(output) || countAnimatedFrames(output) < 2) {
      throw new Error('FFmpeg tidak menghasilkan WebP animasi dengan beberapa frame Brat.');
    }
    return throwOversize(output, MAX_ANIMATED_STICKER_BYTES, 'Sticker animasi');
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function videoToVideoNote(buffer, { maxDuration = 60 } = {}) {
  const duration = Math.max(1, Math.min(60, Number(maxDuration) || 60));
  return withTempMedia(buffer, '.mp4', (input, output) => [
    '-i', input,
    '-t', String(duration),
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', 'scale=512:512:force_original_aspect_ratio=increase:flags=lanczos,crop=512:512,setsar=1,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-f', 'mp4', output,
  ]);
}

function scaleFilter() { return 'scale=512:512:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=512:512:-1:-1:color=black@0'; }
function throwOversize(buffer, limit, kind) { if (buffer.length > limit) throw new Error(`${kind} terlalu besar (${Math.ceil(buffer.length / 1024)} KB).`); return buffer; }
function videoToMp4(buffer, { maxDuration = 60 } = {}) {
  const duration = Math.max(1, Math.min(60, Number(maxDuration) || 60));
  return withTempMedia(buffer, '.mp4', (input, output) => [
    '-i', input, '-t', String(duration),
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,setsar=1,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-f', 'mp4', output,
  ]);
}

function imageToMp4(buffer, { duration = 3 } = {}) {
  const seconds = Math.max(1, Math.min(15, Number(duration) || 3));
  return withTempMedia(buffer, '.mp4', (input, output) => [
    '-loop', '1', '-i', input, '-t', String(seconds),
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage', '-crf', '23',
    '-r', '30', '-an', '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-f', 'mp4', output,
  ]);
}

export function toMp4(buffer, { sourceType = 'video', maxDuration = 60, imageDuration = 3 } = {}) {
  if (sourceType === 'image') return imageToMp4(buffer, { duration: imageDuration });
  if (sourceType === 'video') return videoToMp4(buffer, { maxDuration });
  throw new Error('toMp4 hanya mendukung input gambar atau video.');
}

export function toMp3(buffer) {
  return withTempMedia(buffer, '.mp3', (input, output) => [
    '-i', input, '-map', '0:a:0', '-vn', '-map_metadata', '-1',
    '-c:a', 'libmp3lame', '-ar', '44100', '-ac', '2', '-b:a', '192k',
    '-id3v2_version', '3', '-write_xing', '0', '-f', 'mp3', output,
  ]);
}

export async function toImage(buffer) {
  const source = isAnimatedWebp(buffer) ? await animatedWebpToFirstFrame(buffer) : buffer;
  return withTempMedia(source, '.jpg', (input, output) => [
    '-i', input, '-frames:v', '1', '-map_metadata', '-1', '-c:v', 'mjpeg', '-q:v', '3', '-f', 'image2', output,
  ]);
}

export async function toVideo(buffer, { sourceType = 'sticker', animated = false, videoNote = false, maxDuration = 60 } = {}) {
  if (videoNote) return videoToVideoNote(buffer, { maxDuration });
  if (sourceType !== 'sticker') throw new Error('tovideo hanya mendukung sticker bergerak.');
  if (!isAnimatedWebp(buffer)) {
    if (!animated) throw new Error('tovideo hanya menerima sticker bergerak.');
    throw new Error('Sticker ditandai bergerak tetapi WebP tidak berisi frame animasi yang valid.');
  }
  return animatedWebpToVideo(buffer);
}

export function toVoiceNote(buffer) {
  return withTempMedia(buffer, '.ogg', (input, output) => [
    '-i', input, '-map', '0:a:0', '-vn', '-map_metadata', '-1',
    '-af', 'aresample=async=1:first_pts=0', '-ac', '1', '-ar', '48000',
    '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-application', 'voip',
    '-frame_duration', '20', '-avoid_negative_ts', 'make_zero', '-f', 'ogg', output,
  ]);
}

export function toHd(buffer, { scale = 2 } = {}) {
  const multiplier = Number(scale);
  if (![2, 4].includes(multiplier)) throw new Error('HD hanya mendukung scale 2x atau 4x.');
  return withTempMedia(buffer, '.jpg', (input, output) => [
    '-i', input, '-vf', 'scale=iw*' + multiplier + ':ih*' + multiplier + ':flags=lanczos,format=yuv420p',
    '-frames:v', '1', '-c:v', 'mjpeg', '-q:v', '2', '-f', 'image2', output,
  ]);
}
function wrapMemeText(value, maxChars = 20) {
  const words = String(value).trim().toUpperCase().split(/\s+/).filter(Boolean);
  const output = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (line && next.length > maxChars) { output.push(line); line = word; }
    else line = next;
  }
  if (line) output.push(line);
  return output.join('\n');
}

async function resolveMemeFontFile() {
  for (const fontPath of MEME_FONT_CANDIDATES) {
    try { await access(fontPath); return fontPath; } catch {}
  }
  throw new Error('Font Bold untuk smeme tidak ditemukan. Pastikan Roboto-Bold (Android) atau DejaVuSans-Bold (Linux) tersedia.');
}

function escapeFilterPath(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function memeTextFilter(textFile, position, fontFile) {
  const font = escapeFilterPath(fontFile);
  const file = escapeFilterPath(textFile);
  const y = position === 'top' ? '24' : 'h-text_h-24';
  return "drawtext=fontfile='" + font + "':textfile='" + file + "':fontcolor=white:fontsize=56:borderw=7:bordercolor=black:x=(w-text_w)/2:y=" + y + ':line_spacing=4';
}

export async function toSmeme(buffer, { top = '', bottom = '' } = {}) {
  if (!top && !bottom) throw new Error('Teks meme tidak boleh kosong.');
  const fontFile = await resolveMemeFontFile();
  return withTempMedia(buffer, '.jpg', async (input, output, dir) => {
    const filters = [];
    if (top) {
      const topFile = join(dir, 'meme-top.txt');
      await writeFile(topFile, wrapMemeText(top));
      filters.push(memeTextFilter(topFile, 'top', fontFile));
    }
    if (bottom) {
      const bottomFile = join(dir, 'meme-bottom.txt');
      await writeFile(bottomFile, wrapMemeText(bottom));
      filters.push(memeTextFilter(bottomFile, 'bottom', fontFile));
    }
    return [
      '-i', input,
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,' + filters.join(','),
      '-frames:v', '1', '-map_metadata', '-1',
      '-c:v', 'mjpeg', '-q:v', '3', '-f', 'image2', output,
    ];
  });
}
export async function toStickerWatermark(buffer, { pack = 'SkyVerse', author = 'SkyVerse Bot' } = {}) { return withTempMedia(buffer, '.webp', (input, output) => ['-i', input, '-vf', `${scaleFilter()},format=rgba`, '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '0', '-q:v', '75', '-preset', 'picture', '-metadata', `comment=${pack} | ${author}`, '-f', 'webp', output]); }
export function toSticker(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new Error('Input sticker kosong atau tidak valid.');
  if (isWebp(buffer)) return throwOversize(buffer, isAnimatedWebp(buffer) ? MAX_ANIMATED_STICKER_BYTES : MAX_STATIC_STICKER_BYTES, isAnimatedWebp(buffer) ? 'Sticker animasi' : 'Sticker');
  return withTempMedia(buffer, '.webp', (input, output) => ['-i', input, '-frames:v', '1', '-vf', `${scaleFilter()},format=rgba`, '-c:v', 'libwebp', '-lossless', '0', '-q:v', '75', '-compression_level', '6', '-pix_fmt', 'yuva420p', '-preset', 'picture', '-an', '-f', 'webp', output]).then((output) => throwOversize(output, MAX_STATIC_STICKER_BYTES, 'Sticker'));
}
export async function toAnimatedSticker(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new Error('Input sticker animasi kosong atau tidak valid.');
  if (isAnimatedWebp(buffer)) return throwOversize(buffer, MAX_ANIMATED_STICKER_BYTES, 'Sticker animasi');

  const dir = await mkdtemp(join(tmpdir(), 'skyverse-video-sticker-'));
  try {
    const inputPath = join(dir, 'input.bin');
    const framePattern = join(dir, 'video-frame-%04d.png');
    await writeFile(inputPath, buffer);
    await runProcess('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-i', inputPath,
      '-t', '6',
      '-vf', 'fps=8,' + scaleFilter() + ',format=rgba',
      '-frames:v', String(MAX_ANIMATED_FRAMES),
      '-vsync', '0',
      '-c:v', 'png', '-f', 'image2', framePattern,
    ]);

    const frameNames = (await readdir(dir))
      .filter((name) => /^video-frame-\d{4}\.png$/.test(name))
      .sort();
    if (frameNames.length < 2) throw new Error('Video terlalu singkat atau tidak memiliki frame untuk sticker animasi.');

    const frames = [];
    for (const name of frameNames.slice(0, MAX_ANIMATED_FRAMES)) {
      const frame = await readFile(join(dir, name));
      if (frame.length < 16 || !frame.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        throw new Error('Frame video hasil ekstraksi tidak valid.');
      }
      frames.push(frame);
    }

    const output = await framesToAnimatedWebp(frames, {
      frameDuration: 0.125,
      lastFrameDuration: 0.125,
    });
    if (!isAnimatedWebp(output) || countAnimatedFrames(output) < 2) {
      throw new Error('FFmpeg tidak menghasilkan WebP animasi dengan beberapa frame.');
    }
    const validationPath = join(dir, 'validated.webp');
    const firstFramePath = join(dir, 'validated-frame.webp');
    await writeFile(validationPath, output);
    await runProcess('webpmux', ['-get', 'frame', '1', validationPath, '-o', firstFramePath]);
    const firstFrame = await readFile(firstFramePath);
    if (!isWebp(firstFrame)) throw new Error('Frame pertama WebP hasil konversi tidak valid.');
    return throwOversize(output, MAX_ANIMATED_STICKER_BYTES, 'Sticker animasi');
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
export { framesToAnimatedWebp as toAnimatedStickerFromFrames };
