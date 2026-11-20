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
  if (result.error) throw new Error(`${label} tidak tersedia: ${result.error.message}`);
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

  if (!filters.includes('drawtext')) missing.push('filter drawtext');
  for (const encoder of ['libwebp', 'libx264', 'libmp3lame', 'libopus']) {
    if (!encoders.includes(encoder)) missing.push(`encoder ${encoder}`);
  }

  const cwebp = run('cwebp', ['-version']);
  if (cwebp.error || cwebp.status !== 0) missing.push('binary cwebp yang bisa dijalankan');

  const webpmux = run('webpmux', ['-version']);
  if (webpmux.error || webpmux.status !== 0) missing.push('binary webpmux yang bisa dijalankan');

  if (missing.length) {
    throw new Error(`Komponen media tidak lengkap: ${missing.join(', ')}.`);
  }

  console.log(version.split(/\\r?\\n/).find(Boolean) || 'FFmpeg tersedia.');
  console.log('Media runtime siap: drawtext, libwebp, libx264, libmp3lame, libopus, cwebp, dan webpmux.');
} catch (error) {
  console.error(`Media runtime check gagal: ${error.message}`);
  process.exitCode = 1;
}
