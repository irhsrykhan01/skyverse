import { spawn } from 'node:child_process';

function requestTikwm(baseUrl, url) {
  return new Promise((resolve, reject) => {
    const args = [
      '--silent', '--show-error', '--location',
      '--connect-timeout', '15', '--max-time', '40',
      '--request', 'POST',
      '--header', 'content-type: application/x-www-form-urlencoded; charset=UTF-8',
      '--header', 'origin: https://www.tikwm.com',
      '--header', 'referer: https://www.tikwm.com/',
      '--header', 'user-agent: Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/139 Mobile Safari/537.36',
      '--header', 'x-requested-with: XMLHttpRequest',
      '--data-urlencode', 'url=' + url,
      '--data-urlencode', 'hd=1',
      '--write-out', '\n__SKYVERSE_HTTP_STATUS__:%{http_code}',
      '--url', baseUrl,
    ];

    const child = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('Request TikWM melewati batas waktu.'));
    }, 45_000);

    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    }

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 5 * 1024 * 1024) {
        child.kill('SIGKILL');
        finish(new Error('Response TikWM terlalu besar.'));
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    child.once('error', (error) => {
      if (error.code === 'ENOENT') {
        finish(new Error('curl belum terpasang atau tidak ada di PATH.'));
        return;
      }
      finish(new Error('Gagal menjalankan curl untuk TikWM: ' + error.message));
    });
    child.once('close', (code) => {
      if (settled) return;
      const marker = '\n__SKYVERSE_HTTP_STATUS__:';
      const markerIndex = stdout.lastIndexOf(marker);
      if (markerIndex < 0) {
        finish(new Error('Request TikWM gagal' + (code ? ' (' + code + ')' : '') + ': ' + (stderr.trim() || 'Status HTTP tidak ditemukan.')));
        return;
      }

      const body = stdout.slice(0, markerIndex).trim();
      const status = Number(stdout.slice(markerIndex + marker.length).trim());
      if (code !== 0 || status < 200 || status >= 300) {
        finish(new Error('TikWM HTTP ' + status + ': ' + (body || stderr.trim() || 'Request ditolak.').slice(0, 300)));
        return;
      }

      try {
        finish(null, JSON.parse(body));
      } catch {
        finish(new Error('TikWM mengembalikan response JSON yang tidak valid.'));
      }
    });
  });
}

export function createTikwmProvider({ baseUrl = 'https://www.tikwm.com/api/' } = {}) {
  async function tiktok(url) {
    const response = await requestTikwm(baseUrl, url);
    if (!response || Number(response.code) !== 0 || !response.data) {
      throw new Error(response?.msg ?? 'TikWM gagal mengambil data TikTok.');
    }
    const data = response.data;
    return {
      result: {
        title: data.title ?? null,
        video: data.play ?? null,
        videoWatermark: data.wmplay ?? null,
        audio: data.music ?? null,
        images: Array.isArray(data.images) ? data.images : [],
      },
    };
  }
  return Object.freeze({ tiktok });
}
