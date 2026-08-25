import { spawn } from 'node:child_process';

function runFfmpeg(args, { input, output }) {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    process.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    process.once('error', (error) => reject(new Error(`FFmpeg tidak tersedia: ${error.message}`)));
    process.once('close', (code) => {
      if (code === 0) return resolve(output);
      reject(new Error(`FFmpeg gagal (${code}): ${stderr.trim() || 'unknown error'}`));
    });
    process.stdin.end(input);
  });
}

export async function toMp3(buffer, outputPath) {
  return runFfmpeg(['-i', 'pipe:0', '-vn', '-codec:a', 'libmp3lame', '-q:a', '4', outputPath], { input: buffer, output: outputPath });
}

export async function toImage(buffer, outputPath) {
  return runFfmpeg(['-i', 'pipe:0', '-frames:v', '1', outputPath], { input: buffer, output: outputPath });
}

export async function toVideo(buffer, outputPath) {
  return runFfmpeg(['-i', 'pipe:0', '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', outputPath], { input: buffer, output: outputPath });
}
