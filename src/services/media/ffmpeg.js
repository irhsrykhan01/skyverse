import { spawn } from 'node:child_process';

const MAX_STATIC_STICKER_BYTES = 100 * 1024;
const MAX_ANIMATED_STICKER_BYTES = 500 * 1024;

function runFfmpeg(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', (error) => reject(new Error(`FFmpeg tidak tersedia: ${error.message}`)));
    child.once('close', (code) => {
      if (code === 0) {
        const output = Buffer.concat(stdout);
        if (!output.length) return reject(new Error('FFmpeg tidak menghasilkan file output yang valid.'));
        return resolve(output);
      }
      reject(new Error(`FFmpeg gagal (${code}): ${Buffer.concat(stderr).toString().trim() || 'unknown error'}`));
    });
    child.stdin.end(input);
  });
}

function scaleFilter() {
  return 'scale=512:512:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=512:512:-1:-1:color=black@0';
}

function throwOversize(buffer, limit, kind) {
  if (buffer.length > limit) throw new Error(`${kind} terlalu besar (${Math.ceil(buffer.length / 1024)} KB).`);
  return buffer;
}

function escapeDrawtext(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%');
}

export async function toMp3(buffer) {
  return runFfmpeg([
    '-i', 'pipe:0',
    '-map', '0:a:0',
    '-vn',
    '-map_metadata', '-1',
    '-c:a', 'libmp3lame',
    '-ar', '44100',
    '-ac', '2',
    '-b:a', '192k',
    '-id3v2_version', '3',
    '-write_xing', '0',
    '-f', 'mp3',
    'pipe:1',
  ], buffer);
}

export async function toImage(buffer) {
  return runFfmpeg([
    '-i', 'pipe:0',
    '-frames:v', '1',
    '-map_metadata', '-1',
    '-c:v', 'mjpeg',
    '-q:v', '3',
    '-f', 'image2pipe',
    'pipe:1',
  ], buffer);
}

export async function toVideo(buffer, { sourceType = 'sticker', animated = false } = {}) {
  if (sourceType !== 'sticker' || !animated) throw new Error('tovideo hanya mendukung sticker bergerak.');
  return runFfmpeg([
    '-i', 'pipe:0',
    '-map', '0:v:0',
    '-an',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,fps=30,format=yuv420p',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-movflags', '+faststart',
    '-f', 'mp4',
    'pipe:1',
  ], buffer);
}

export async function toVoiceNote(buffer) {
  return runFfmpeg([
    '-i', 'pipe:0',
    '-map', '0:a:0',
    '-vn',
    '-map_metadata', '-1',
    '-ac', '1',
    '-ar', '48000',
    '-c:a', 'libopus',
    '-b:a', '32k',
    '-vbr', 'on',
    '-application', 'voip',
    '-frame_duration', '20',
    '-avoid_negative_ts', 'make_zero',
    '-f', 'ogg',
    'pipe:1',
  ], buffer);
}

export async function toHd(buffer, { scale = 2 } = {}) {
  const multiplier = Number(scale);
  if (![2, 4].includes(multiplier)) throw new Error('HD hanya mendukung scale 2x atau 4x.');
  return runFfmpeg([
    '-i', 'pipe:0',
    '-vf', `scale=iw*${multiplier}:ih*${multiplier}:flags=lanczos,format=yuv420p`,
    '-frames:v', '1', '-c:v', 'mjpeg', '-q:v', '2', '-f', 'image2pipe', 'pipe:1',
  ], buffer);
}

function wrapMemeText(value, maxChars = 20) {
  const words = String(value).trim().toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.join('\\n');
}

function memeTextFilter(text, position) {
  const wrapped = escapeDrawtext(wrapMemeText(text));
  const y = position === 'top' ? '24' : 'h-text_h-24';
  return `drawtext=font='DejaVu Sans:style=Bold':text='${wrapped}':fontcolor=white:fontsize=56:borderw=7:bordercolor=black:x=(w-text_w)/2:y=${y}:line_spacing=4`;
}

export async function toSmeme(buffer, { top = '', bottom = '' } = {}) {
  const filters = [];
  if (top) filters.push(memeTextFilter(top, 'top'));
  if (bottom) filters.push(memeTextFilter(bottom, 'bottom'));
  if (!filters.length) throw new Error('Masukkan teks atas atau bawah untuk smeme.');
  return runFfmpeg([
    '-i', 'pipe:0',
    '-vf', filters.join(','),
    '-frames:v', '1', '-c:v', 'mjpeg', '-q:v', '3', '-f', 'image2pipe', 'pipe:1',
  ], buffer);
}

export async function toStickerWatermark(buffer, { text = 'SkyVerse' } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new Error('Data sticker kosong atau tidak valid.');
  const watermark = String(text).trim().slice(0, 80);
  if (!watermark) throw new Error('Teks watermark tidak boleh kosong.');
  const output = await runFfmpeg([
    '-i', 'pipe:0', '-frames:v', '1',
    '-vf', `drawtext=text='${escapeDrawtext(watermark)}':fontcolor=white@0.9:fontsize=24:box=1:boxcolor=black@0.45:boxborderw=8:x=w-text_w-12:y=h-text_h-12,${scaleFilter()}`,
    '-c:v', 'libwebp', '-lossless', '0', '-q:v', '60', '-compression_level', '6', '-preset', 'picture', '-an', '-f', 'webp', 'pipe:1',
  ], buffer);
  return throwOversize(output, MAX_STATIC_STICKER_BYTES, 'Sticker watermark');
}

export async function toSticker(buffer) {
  const output = await runFfmpeg(['-i', 'pipe:0', '-frames:v', '1', '-vf', scaleFilter(), '-c:v', 'libwebp', '-lossless', '0', '-q:v', '55', '-compression_level', '6', '-preset', 'picture', '-an', '-f', 'webp', 'pipe:1'], buffer);
  return throwOversize(output, MAX_STATIC_STICKER_BYTES, 'Sticker');
}

export async function toAnimatedSticker(buffer) {
  const output = await runFfmpeg(['-t', '6', '-i', 'pipe:0', '-vf', `fps=8,${scaleFilter()}`, '-c:v', 'libwebp', '-lossless', '0', '-q:v', '55', '-compression_level', '6', '-loop', '0', '-an', '-f', 'webp', 'pipe:1'], buffer);
  return throwOversize(output, MAX_ANIMATED_STICKER_BYTES, 'Sticker animasi');
}
