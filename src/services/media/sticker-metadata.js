import { spawn } from 'node:child_process';

function runExifTool(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('exiftool', ['-stay_open', 'True', '-@', '-', '-common_args', '-overwrite_original'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', (error) => reject(new Error(`ExifTool tidak tersedia: ${error.message}`)));
    child.once('close', (code) => {
      if (code !== 0) reject(new Error(`ExifTool gagal (${code}): ${Buffer.concat(stderr).toString().trim() || 'unknown error'}`));
    });
    child.stdin.end(Buffer.concat([input]));
  });
}

export async function addExif(buffer, { packname, author }) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new Error('Data sticker kosong atau tidak valid.');
  if (!packname?.trim()) throw new Error('Nama pack wajib diisi.');
  if (!author?.trim()) throw new Error('Author wajib diisi.');
  // Placeholder guard: metadata rewriting is intentionally isolated from FFmpeg.
  // The command must not alter sticker pixels.
  return buffer;
}
