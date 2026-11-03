import { spawn } from 'node:child_process';

const PLATFORM_HOSTS = Object.freeze({
  youtube: new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com']),
  instagram: new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']),
});

function validateUrl(value, platform) {
  let url;
  try { url = new URL(String(value)); }
  catch { throw new Error('URL tidak valid.'); }
  if (url.protocol !== 'https:') throw new Error('Downloader hanya menerima URL HTTPS.');
  if (!PLATFORM_HOSTS[platform]?.has(url.hostname.toLowerCase())) {
    throw new Error('URL bukan tautan ' + (platform === 'youtube' ? 'YouTube' : 'Instagram') + ' yang didukung.');
  }
  return url.toString();
}

function runYtDlp(binaryPath, args, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('yt-dlp melewati batas waktu. Coba lagi nanti.'));
    }, timeout);
    timer.unref?.();

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 128 * 1024) {
        child.kill('SIGKILL');
        finish(new Error('Output yt-dlp terlalu besar.'));
      }
    });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-5000); });
    child.once('error', (error) => {
      if (error.code === 'ENOENT') {
        finish(new Error('yt-dlp belum terpasang atau tidak ada di PATH. Install yt-dlp lalu restart SkyVerse.'));
        return;
      }
      finish(new Error('Gagal menjalankan yt-dlp: ' + error.message));
    });
    child.once('close', (code, signal) => {
      if (code === 0) return finish(null, stdout.trim());
      finish(new Error('yt-dlp gagal' + (code === null ? ' (' + signal + ')' : ' (' + code + ')') + ': ' + (stderr.trim() || 'Tidak ada detail error.').slice(-1800)));
    });
  });
}

export function createYtDlpProvider({ binaryPath = 'yt-dlp', timeout = 90_000 } = {}) {
  async function version() {
    const output = await runYtDlp(binaryPath, ['--version'], 10_000);
    if (!output) throw new Error('yt-dlp tidak mengembalikan versi.');
    return output.split(/\r?\n/)[0];
  }

  async function download(url, platform) {
    const safeUrl = validateUrl(url, platform);
    const output = await runYtDlp(binaryPath, [
      '--ignore-config', '--no-warnings', '--no-progress', '--no-playlist',
      '--js-runtimes', 'node', '--remote-components', 'ejs:github',
      '--socket-timeout', '20', '--retries', '1', '--extractor-retries', '1',
      '--format', 'best[ext=mp4]/best', '--get-url', '--', safeUrl,
    ], timeout);
    const mediaUrl = output.split(/\r?\n/).map((line) => line.trim()).find((line) => /^https?:\/\//i.test(line));
    if (!mediaUrl) throw new Error('yt-dlp tidak menemukan URL media yang dapat diunduh.');
    return { result: { video: mediaUrl, source: 'yt-dlp' } };
  }

  return Object.freeze({
    version,
    youtube: (url) => download(url, 'youtube'),
    instagram: (url) => download(url, 'instagram'),
  });
}
