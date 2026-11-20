import { spawnSync } from 'node:child_process';

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 4 * 1024 * 1024,
  });
}

function requireCommand(command, args, label) {
  const result = run(command, args);
  if (result.error) {
    throw new Error(`${label} tidak tersedia: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} gagal dijalankan: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result.stdout || result.stderr || '';
}

try {
  const version = requireCommand('ffmpeg', ['-version'], 'FFmpeg');
  const filters = requireCommand('ffmpeg', ['-hide_banner', '-filters'], 'Daftar filter FFmpeg');
  const encoders = requireCommand('ffmpeg', ['-hide_banner', '-encoders'], 'Daftar encoder FFmpeg');
  const missing = [];

  for (const filter of ['drawtext']) {
    if (!new RegExp(`\\\\b${filter}\\\\b`).test(filters)) missing.push(`filter ${filter}`);
  }
  for (const encoder of ['libwebp', 'libx264', 'libmp3lame', 'libopus']) {
    if (!new RegExp(`\\\\b${encoder}\\\\b`).test(encoders)) missing.push(`encoder ${encoder}`);
  }

  const webpmux = run('webpmux', ['-version']);
  if (webpmux.error) missing.push('binary webpmux');

  if (missing.length) {
    throw new Error(`Komponen media tidak lengkap: ${missing.join(', ')}.`);
  }

  console.log(version.split('\\n').find(Boolean) || 'FFmpeg tersedia.');
  console.log('Media runtime siap: drawtext, libwebp, libx264, libmp3lame, libopus, dan webpmux.');
} catch (error) {
  console.error(`Media runtime check gagal: ${error.message}`);
  process.exitCode = 1;
}
