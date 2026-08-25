import { spawn } from 'node:child_process';

const MAX_STATIC_STICKER_BYTES = 100 * 1024;
const MAX_ANIMATED_STICKER_BYTES = 500 * 1024;

function runFfmpeg(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', (error) => reject(new Error(`FFmpeg tidak tersedia: ${error.message}`)));
    child.once('close', (code) => {
      if (code === 0) return resolve(Buffer.concat(stdout));
      reject(new Error(`FFmpeg gagal (${code}): ${Buffer.concat(stderr).toString().trim() || 'unknown error'}`));
    });
    child.stdin.end(input);
  });
}

function runFfmpegToFile(args, input, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    const stderr = [];
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', (error) => reject(new Error(`FFmpeg tidak tersedia: ${error.message}`)));
    child.once('close', (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`FFmpeg gagal (${code}): ${Buffer.concat(stderr).toString().trim() || 'unknown error'}`));
    });
    child.stdin.end(input);
  });
}

function scaleFilter() {
  return 'scale=512:512:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=512:512:-1:-1:color=black@0';
}

function throwOversize(buffer, limit, kind) {
  if (buffer.length > limit) {
    throw new Error(`${kind} terlalu besar (${Math.ceil(buffer.length / 1024)} KB).`);
  }
  return buffer;
}

export async function toMp3(buffer, outputPath) {
  return runFfmpegToFile(
    ['-i', 'pipe:0', '-vn', '-codec:a', 'libmp3lame', '-q:a', '4', outputPath],
    buffer,
    outputPath,
  );
}

export async function toImage(buffer, outputPath) {
  return runFfmpegToFile(['-i', 'pipe:0', '-frames:v', '1', outputPath], buffer, outputPath);
}

export async function toVideo(buffer, outputPath) {
  return runFfmpegToFile(
    ['-i', 'pipe:0', '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', outputPath],
    buffer,
    outputPath,
  );
}

export async function toSticker(buffer) {
  const output = await runFfmpeg(
    [
      '-i', 'pipe:0',
      '-vf', scaleFilter(),
      '-c:v', 'libwebp',
      '-lossless', '0',
      '-q:v', '55',
      '-compression_level', '6',
      '-preset', 'picture',
      '-an',
      '-f', 'webp',
      'pipe:1',
    ],
    buffer,
  );
  return throwOversize(output, MAX_STATIC_STICKER_BYTES, 'Sticker');
}

export async function toAnimatedSticker(buffer) {
  const output = await runFfmpeg(
    [
      '-t', '6',
      '-i', 'pipe:0',
      '-vf', `fps=8,${scaleFilter()}`,
      '-c:v', 'libwebp',
      '-lossless', '0',
      '-q:v', '55',
      '-compression_level', '6',
      '-loop', '0',
      '-an',
      '-f', 'webp',
      'pipe:1',
    ],
    buffer,
  );
  return throwOversize(output, MAX_ANIMATED_STICKER_BYTES, 'Sticker animasi');
}
