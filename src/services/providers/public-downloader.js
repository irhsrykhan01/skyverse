import { spawn } from 'node:child_process';

const USER_AGENT = 'SkyVerseDownloader/1.0 (+WhatsApp bot)';
const SIPUTZ = 'https://api.siputzx.my.id';
const TIKWM = 'https://www.tikwm.com/api/';

export function normalizeYouTubeUrl(value) {
  let parsed;
  try { parsed = new URL(String(value)); }
  catch { throw new Error('Masukkan URL YouTube yang valid.'); }

  const host = parsed.hostname.toLowerCase().replace(/^www\\./, '');
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    throw new Error('URL harus berasal dari YouTube.');
  }

  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    if (!id) throw new Error('URL YouTube tidak memiliki ID video.');
    return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (['shorts', 'live', 'embed', 'v'].includes(parts[0]) && parts[1]) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(parts[1])}`;
  }
  if (parsed.searchParams.has('v')) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(parsed.searchParams.get('v'))}`;
  }
  throw new Error('URL YouTube tidak memiliki ID video yang valid.');
}

function normalizeInstagramUrl(value) {
  let parsed;
  try { parsed = new URL(String(value)); }
  catch { throw new Error('Masukkan URL Instagram yang valid.'); }
  const host = parsed.hostname.toLowerCase().replace(/^www\\./, '');
  if (!['instagram.com', 'm.instagram.com'].includes(host)) {
    throw new Error('URL harus berasal dari Instagram.');
  }
  if (!/^\\/(?:p|reel|reels|tv)\\/[A-Za-z0-9_-]+\\/?/.test(parsed.pathname)) {
    throw new Error('Gunakan URL postingan, Reel, atau video Instagram yang valid.');
  }
  return parsed.toString();
}

function runProcess(command, args, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('yt-dlp melewati batas waktu 60 detik.'));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 8 * 1024 * 1024) {
        child.kill('SIGKILL');
        finish(new Error('Metadata Instagram dari yt-dlp terlalu besar.'));
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 16_384) stderr = stderr.slice(-16_384);
    });
    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        finish(Object.assign(new Error(`Perintah ${command} tidak ditemukan.`), { code: 'ENOENT' }));
      } else finish(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        const detail = stderr.trim().split('\\n').slice(-3).join(' ').slice(0, 500);
        finish(new Error(detail || `yt-dlp berhenti dengan kode ${code}.`));
        return;
      }
      finish(null, stdout);
    });
  });
}

async function getYtDlpJson(url) {
  const args = ['--dump-single-json', '--no-warnings', '--no-playlist', '--no-progress', url];
  let output;
  try {
    output = await runProcess('yt-dlp', args);
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`yt-dlp gagal mengambil Instagram: ${error.message}`);
    try {
      output = await runProcess('python3', ['-m', 'yt_dlp', ...args]);
    } catch (pythonError) {
      if (pythonError.code === 'ENOENT' || /No module named yt_dlp/.test(pythonError.message)) {
        throw new Error('yt-dlp belum terpasang di server. Pasang yt-dlp pada environment Pterodactyl terlebih dahulu.');
      }
      throw new Error(`yt-dlp gagal mengambil Instagram: ${pythonError.message}`);
    }
  }

  try { return JSON.parse(output); }
  catch { throw new Error('yt-dlp tidak menghasilkan metadata JSON Instagram yang valid.'); }
}

function bestDirectUrl(item) {
  if (typeof item?.url === 'string' && /^https?:\\/\\//i.test(item.url)) return item.url;
  const requested = item?.requested_downloads?.find((entry) => /^https?:\\/\\//i.test(entry?.url ?? ''));
  if (requested) return requested.url;
  const formats = (item?.formats ?? [])
    .filter((format) => /^https?:\\/\\//i.test(format?.url ?? ''))
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  return formats[0]?.url ?? null;
}

function toInstagramMedia(item) {
  const url = bestDirectUrl(item);
  if (!url) return null;
  const ext = String(item?.ext ?? '').toLowerCase();
  const image = ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext);
  return {
    url,
    type: image ? 'image' : 'video',
    mimeType: image ? (ext === 'png' ? 'image/png' : 'image/jpeg') : 'video/mp4',
  };
}

function normalizeInstagramInfo(info) {
  const entries = Array.isArray(info?.entries) ? info.entries : null;
  if (entries) {
    const medias = entries.map(toInstagramMedia).filter(Boolean);
    if (!medias.length) throw new Error('yt-dlp tidak menemukan file media pada postingan Instagram ini.');
    return { result: { medias, title: info.title ?? 'Instagram' } };
  }

  const media = toInstagramMedia(info);
  if (!media) throw new Error('yt-dlp tidak menemukan URL media Instagram yang bisa diunduh.');
  return {
    result: media.type === 'image'
      ? { images: [media.url], title: info.title ?? 'Instagram' }
      : { video: media.url, title: info.title ?? 'Instagram' },
  };
}

function withUrl(endpoint, sourceUrl) {
  const url = new URL(endpoint);
  url.searchParams.set('url', sourceUrl);
  return url;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      'user-agent': USER_AGENT,
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(25_000),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const contentType = response.headers.get('content-type') ?? 'unknown content-type';
    const preview = text.replace(/\\s+/g, ' ').trim().slice(0, 180);
    const status = `HTTP ${response.status}`;
    throw new Error(`Provider mengirim respons non-JSON (${status}, ${contentType})${preview ? `: ${preview}` : '.'}`);
  }

  if (!response.ok) {
    const detail = data?.message ?? data?.error?.message ?? data?.error ?? `HTTP ${response.status}`;
    throw new Error(`Downloader gagal (${response.status}): ${String(detail)}`);
  }
  if (data?.success === false || data?.status === false || (typeof data?.code === 'number' && data.code !== 0)) {
    throw new Error(String(data?.message ?? data?.msg ?? data?.error?.message ?? data?.error ?? 'Provider menolak permintaan.'));
  }
  return data;
}

function unwrap(data) {
  const payload = data?.data ?? data?.result ?? data;
  return { result: payload };
}

function absoluteTikwmUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return value;
  if (/^https?:\\/\\//i.test(value)) return value;
  return new URL(value, 'https://www.tikwm.com').toString();
}

function normalizeTikwm(data) {
  const item = data?.data;
  if (!item || data?.code !== 0) throw new Error(String(data?.msg ?? 'TikWM tidak menemukan media.'));
  const images = Array.isArray(item.images) ? item.images.map(absoluteTikwmUrl) : [];
  return {
    result: {
      title: item.title ?? 'TikTok Media',
      author: item.author?.nickname ?? item.author?.unique_id ?? null,
      video: absoluteTikwmUrl(item.hdplay ?? item.play),
      audio: absoluteTikwmUrl(item.music_info?.play ?? item.music),
      images,
    },
  };
}

export function createPublicDownloaderProvider() {
  async function siputzx(path, url) {
    return unwrap(await requestJson(withUrl(`${SIPUTZ}/api/d/${path}`, url)));
  }

  async function tikwm(url) {
    const endpoint = withUrl(TIKWM, url);
    endpoint.searchParams.set('hd', '1');
    return normalizeTikwm(await requestJson(endpoint));
  }

  return Object.freeze({
    tiktok: tikwm,
    youtube: (url) => siputzx('ytmp4', normalizeYouTubeUrl(url)),
    youtubeMp3: (url) => siputzx('ytmp3', normalizeYouTubeUrl(url)),
    instagram: async (url) => normalizeInstagramInfo(await getYtDlpJson(normalizeInstagramUrl(url))),
    pinterest: (url) => siputzx('pinterest', url),
    capcut: (url) => siputzx('capcut', url),
    twitter: (url) => siputzx('twitter', url),
    mediafire: (url) => siputzx('mediafire', url),
  });
}
