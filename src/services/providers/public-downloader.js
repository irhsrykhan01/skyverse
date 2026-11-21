const USER_AGENT = 'SkyVerseDownloader/1.0 (+WhatsApp bot)';
const SIPUTZ = 'https://api.siputzx.my.id';
const RYZUMI = 'https://api.ryzumi.net/api/downloader/all-in-one';
const TIKWM = 'https://www.tikwm.com/api/';

export function normalizeYouTubeUrl(value) {
  let parsed;
  try { parsed = new URL(String(value)); }
  catch { throw new Error('Masukkan URL YouTube yang valid.'); }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
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
  try { data = text ? JSON.parse(text) : null; }
  catch { throw new Error('Downloader mengirim respons yang bukan JSON.'); }

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
  if (/^https?:\/\//i.test(value)) return value;
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

  async function ryzumi(url) {
    return unwrap(await requestJson(withUrl(RYZUMI, url)));
  }

  async function tikwm(url) {
    const endpoint = withUrl(TIKWM, url);
    endpoint.searchParams.set('hd', '1');
    return normalizeTikwm(await requestJson(endpoint));
  }

  async function withRyzumiFallback(primary, url) {
    try { return await primary(); }
    catch (primaryError) {
      try { return await ryzumi(url); }
      catch (fallbackError) {
        const error = new Error(fallbackError?.message ?? primaryError?.message ?? 'Semua provider downloader gagal.');
        error.cause = { primary: primaryError, fallback: fallbackError };
        throw error;
      }
    }
  }

  return Object.freeze({
    tiktok: tikwm,
    youtube: (url) => siputzx('ytmp4', normalizeYouTubeUrl(url)),
    youtubeMp3: (url) => siputzx('ytmp3', normalizeYouTubeUrl(url)),
    instagram: (url) => withRyzumiFallback(() => siputzx('igdl', url), url),
    pinterest: (url) => siputzx('pinterest', url),
    capcut: (url) => siputzx('capcut', url),
    twitter: (url) => withRyzumiFallback(() => siputzx('twitter', url), url),
    mediafire: (url) => siputzx('mediafire', url),
  });
}
