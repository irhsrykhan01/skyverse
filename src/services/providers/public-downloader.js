const USER_AGENT = 'SkyVerseDownloader/1.0 (+WhatsApp bot)';

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
  try { data = text ? JSON.parse(text) : null; } catch { throw new Error('Provider downloader mengirim respons non-JSON.'); }
  if (!response.ok) {
    const detail = data?.message ?? data?.error?.message ?? data?.error ?? `HTTP ${response.status}`;
    const error = new Error(`Public downloader gagal (${response.status}): ${String(detail)}`);
    error.status = response.status;
    throw error;
  }
  if (data?.success === false || data?.status === false || (typeof data?.code === 'number' && data.code !== 0)) {
    throw new Error(String(data?.message ?? data?.msg ?? data?.error?.message ?? data?.error ?? 'Provider menolak permintaan.'));
  }
  return data;
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
  const audio = item.music_info?.play ?? item.music ?? null;
  return {
    result: {
      title: item.title ?? 'TikTok Media',
      author: item.author?.nickname ?? item.author?.unique_id ?? null,
      video: absoluteTikwmUrl(item.hdplay ?? item.play),
      audio: absoluteTikwmUrl(audio),
      images,
    },
  };
}

export function createPublicDownloaderProvider() {
  const siputzx = 'https://api.siputzx.my.id';
  const ryzumi = 'https://api.ryzumi.net/api/downloader/all-in-one';

  async function siputzxPath(path, url) {
    return requestJson(withUrl(`${siputzx}${path}`, url));
  }

  async function allInOne(url) {
    return requestJson(withUrl(ryzumi, url));
  }

  async function tiktok(url) {
    const form = new URLSearchParams({ url, count: '12', cursor: '0', web: '1', hd: '1' });
    const data = await requestJson('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: form,
    });
    return normalizeTikwm(data);
  }

  async function withRyzumiFallback(primary, url) {
    try { return await primary(); }
    catch (primaryError) {
      try { return await allInOne(url); }
      catch (fallbackError) {
        const error = new Error(fallbackError?.message ?? primaryError?.message ?? 'Semua public downloader gagal.');
        error.cause = { primary: primaryError, fallback: fallbackError };
        throw error;
      }
    }
  }

  return Object.freeze({
    tiktok,
    youtube: (url) => siputzxPath('/api/d/savefrom', url),
    youtubeMp3: (url) => siputzxPath('/api/d/savefrom', url),
    instagram: (url) => withRyzumiFallback(() => siputzxPath('/api/d/igdl', url), url),
    pinterest: (url) => siputzxPath('/api/d/pinterest', url),
    capcut: (url) => siputzxPath('/api/d/capcut', url),
    twitter: (url) => withRyzumiFallback(() => siputzxPath('/api/d/twitter', url), url),
    mediafire: (url) => siputzxPath('/api/d/mediafire', url),
    allInOne,
  });
}
