import { spawn } from 'node:child_process';

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

function scaleFilter() {
  return 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=0x00000000';
}

export async function toMp3(buffer, outputPath) {
  return runFfmpegToFile(
    ['-i', 'pipe:0', '-vn', '-codec:a', 'libmp3lame', '-q:a', '4', outputPath],
    buffer,
    outputPath,
  );
}

async function runFfmpegToFile(args, input, outputPath) {
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    const stderr = [];
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', (error) => reject(new Error(`FFmpeg tidak tersedia: ${error.message}`)));
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg gagal (${code}): ${Buffer.concat(stderr).toString().trim() || 'unknown error'}`));
    });
    child.stdin.end(input);
  });
  return outputPath;
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
  return runFfmpeg(
    [
      '-i', 'pipe:0',
      '-vf', scaleFilter(),
      '-c:v', 'libwebp',
      '-lossless', '1',
      '-q:v', '80',
      '-preset', 'default',
      '-an',
      '-f', 'webp',
      'pipe:1',
    ],
    buffer,
  );
}

export async function toAnimatedSticker(buffer) {
  return runFfmpeg(
    [
      '-i', 'pipe:0',
      '-vf', `fps=10,${scaleFilter()}`,
      '-c:v', 'libwebp',
      '-lossless', '0',
      '-q:v', '65',
      '-loop', '0',
      '-an',
      '-f', 'webp',
      'pipe:1',
    ],
    buffer,
  );
}
