import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_STATIC_STICKER_BYTES = 100 * 1024;
const MAX_ANIMATED_STICKER_BYTES = 500 * 1024;
const MAX_ANIMATED_FRAMES = 180;

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
    await runProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...buildArgs(inputPath, outputPath)]);
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
function escapeDrawtext(text) { return String(text).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%'); }

export function toMp3(buffer) { return withTempMedia(buffer, '.mp3', (input, output) => ['-i', input, '-map', '0:a:0', '-vn', '-map_metadata', '-1', '-c:a', 'libmp3lame', '-ar', '44100', '-ac', '2', '-b:a', '192k', '-id3v2_version', '3', '-write_xing', '0', '-f', 'mp3', output]); }
export async function toImage(buffer) { const source = isAnimatedWebp(buffer) ? await animatedWebpToFirstFrame(buffer) : buffer; return withTempMedia(source, '.jpg', (input, output) => ['-i', input, '-frames:v', '1', '-map_metadata', '-1', '-c:v', 'mjpeg', '-q:v', '3', '-f', 'image2', output]); }
export async function toVideo(buffer, { sourceType = 'sticker', animated = false, videoNote = false, maxDuration = 60 } = {}) { if (videoNote) return videoToVideoNote(buffer, { maxDuration }); if (sourceType !== 'sticker') throw new Error('tovideo hanya mendukung sticker bergerak.'); if (!isAnimatedWebp(buffer)) { if (!animated) throw new Error('tovideo hanya menerima sticker bergerak.'); throw new Error('Sticker ditandai bergerak tetapi WebP tidak berisi frame animasi yang valid.'); } return animatedWebpToVideo(buffer); }
export function toVoiceNote(buffer) { return withTempMedia(buffer, '.ogg', (input, output) => ['-i', input, '-map', '0:a:0', '-vn', '-map_metadata', '-1', '-af', 'aresample=async=1:first_pts=0', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-application', 'voip', '-frame_duration', '20', '-avoid_negative_ts', 'make_zero', '-f', 'ogg', output]); }
export function toHd(buffer, { scale = 2 } = {}) { const multiplier = Number(scale); if (![2, 4].includes(multiplier)) throw new Error('HD hanya mendukung scale 2x atau 4x.'); return withTempMedia(buffer, '.jpg', (input, output) => ['-i', input, '-vf', `scale=iw*${multiplier}:ih*${multiplier}:flags=lanczos,format=yuv420p`, '-frames:v', '1', '-c:v', 'mjpeg', '-q:v', '2', '-f', 'image2', output]); }
function wrapMemeText(value, maxChars = 20) { const words = String(value).trim().toUpperCase().split(/\s+/).filter(Boolean); const lines = []; let line = ''; for (const word of words) { const next = line ? `${line} ${word}` : word; if (line && next.length > maxChars) { lines.push(line); line = word; } else line = next; } if (line) lines.push(line); return lines.join('\\n'); }
function memeTextFilter(text, position) { const wrapped = escapeDrawtext(wrapMemeText(text)); const y = position === 'top' ? '24' : 'h-text_h-24'; return `drawtext=font='DejaVu Sans:style=Bold':text='${wrapped}':fontcolor=white:fontsize=56:borderw=7:bordercolor=black:x=(w-text_w)/2:y=${y}:line_spacing=4`; }
export function toSmeme(buffer, { top = '', bottom = '' } = {}) { const filters = []; if (top) filters.push(memeTextFilter(top, 'top')); if (bottom) filters.push(memeTextFilter(bottom, 'bottom')); if (!filters.length) throw new Error('Teks meme tidak boleh kosong.'); return withTempMedia(buffer, '.jpg', (input, output) => ['-i', input, '-vf', `${scaleFilter()},${filters.join(',')}`, '-frames:v', '1', '-map_metadata', '-1', '-c:v', 'mjpeg', '-q:v', '3', '-f', 'image2', output]); }
export async function toStickerWatermark(buffer, { pack = 'SkyVerse', author = 'SkyVerse Bot' } = {}) { return withTempMedia(buffer, '.webp', (input, output) => ['-i', input, '-vf', `${scaleFilter()},format=rgba`, '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '0', '-q:v', '75', '-preset', 'picture', '-metadata', `comment=${pack} | ${author}`, '-f', 'webp', output]); }
export function toSticker(buffer) { return withTempMedia(buffer, '.webp', (input, output) => ['-i', input, '-frames:v', '1', '-vf', scaleFilter(), '-c:v', 'libwebp', '-lossless', '0', '-q:v', '55', '-compression_level', '6', '-preset', 'picture', '-an', '-f', 'webp', output]).then((output) => throwOversize(output, MAX_STATIC_STICKER_BYTES, 'Sticker')); }
export function toAnimatedSticker(buffer) { return withTempMedia(buffer, '.webp', (input, output) => ['-t', '6', '-i', input, '-vf', `fps=8,${scaleFilter()}`, '-c:v', 'libwebp', '-lossless', '0', '-q:v', '55', '-compression_level', '6', '-loop', '0', '-an', '-f', 'webp', output]).then((output) => throwOversize(output, MAX_ANIMATED_STICKER_BYTES, 'Sticker animasi')); }
