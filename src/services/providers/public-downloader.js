const USER_AGENT = 'SkyVerseDownloader/1.0 (+WhatsApp bot)';
const CAPCUT_API_BASE = 'https://api.siputzx.my.id';
const BTCH_API_BASE = 'https://btch-downloader-api-green.vercel.app';
const TIKWM = 'https://www.tikwm.com/api/';
const REQUEST_TIMEOUT_MS = 45_000;

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
    return 'https://www.youtube.com/watch?v=' + encodeURIComponent(id);
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (['shorts', 'live', 'embed', 'v'].includes(parts[0]) && parts[1]) {
    return 'https://www.youtube.com/watch?v=' + encodeURIComponent(parts[1]);
  }
  if (parsed.searchParams.has('v')) {
    return 'https://www.youtube.com/watch?v=' + encodeURIComponent(parsed.searchParams.get('v'));
  }
  throw new Error('URL YouTube tidak memiliki ID video yang valid.');
}

function normalizeAllowedUrl(value, domains, message) {
  let parsed;
  try { parsed = new URL(String(value)); }
  catch { throw new Error(message); }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const allowed = domains.some((domain) => host === domain || host.endsWith('.' + domain));
  if (!['http:', 'https:'].includes(parsed.protocol) || !allowed) throw new Error(message);
  return parsed.toString();
}

function normalizeInstagramUrl(value) {
  const url = normalizeAllowedUrl(value, ['instagram.com'], 'Masukkan URL postingan atau Reel Instagram yang valid.');
  const parsed = new URL(url);
  if (!/^\/(?:p|reel|reels|tv)\/[A-Za-z0-9_-]+\/?/i.test(parsed.pathname)) {
    throw new Error('Gunakan URL postingan, Reel, atau video Instagram.');
  }
  return url;
}

function normalizePinterestUrl(value) {
  return normalizeAllowedUrl(value, ['pinterest.com', 'pin.it'], 'Masukkan URL Pinterest atau pin.it yang valid.');
}

function normalizeTwitterUrl(value) {
  const url = normalizeAllowedUrl(value, ['x.com', 'twitter.com'], 'Masukkan URL postingan X/Twitter yang valid.');
  if (!/\/status\/\d+/i.test(new URL(url).pathname)) {
    throw new Error('Gunakan URL postingan X/Twitter yang memiliki ID status.');
  }
  return url;
}

function withUrl(endpoint, sourceUrl) {
  const url = new URL(endpoint);
  url.searchParams.set('url', sourceUrl);
  return url;
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const contentType = response.headers.get('content-type') ?? 'unknown content-type';
    const preview = text.replace(/\s+/g, ' ').trim().slice(0, 180);
    throw new Error('Provider mengirim respons non-JSON (HTTP ' + response.status + ', ' + contentType + ')' + (preview ? ': ' + preview : '.'));
  }

  if (!response.ok) {
    const detail = data?.message ?? data?.error?.message ?? data?.error ?? 'HTTP ' + response.status;
    throw new Error('Downloader gagal (' + response.status + '): ' + String(detail));
  }
  if (data?.success === false || data?.status === false || (typeof data?.code === 'number' && data.code !== 0)) {
    throw new Error(String(data?.message ?? data?.msg ?? data?.error?.message ?? data?.error ?? 'Provider menolak permintaan.'));
  }
  return data;
}

function isMediaUrl(value) {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value);
}

function getRawResult(data) {
  return data?.result && typeof data.result === 'object' ? data.result : {};
}

function getNormalizedItems(data) {
  const normalized = data?.normalized;
  if (normalized?.kind === 'media' && Array.isArray(normalized.media)) return normalized.media;
  if (normalized?.kind === 'list' && Array.isArray(normalized.items)) {
    return normalized.items.filter((item) => item?.downloadable !== false);
  }
  return [];
}

function getRawMediaItems(data, platform) {
  const raw = getRawResult(data);
  const platformKey = String(platform).toLowerCase();

  if (platformKey === 'youtube') {
    return [
      ...(isMediaUrl(raw.mp4) ? [{ label: 'MP4 Video', type: 'video', url: raw.mp4 }] : []),
      ...(isMediaUrl(raw.mp3) ? [{ label: 'MP3 Audio', type: 'audio', url: raw.mp3 }] : []),
    ];
  }

  if (platformKey === 'instagram') {
    const list = Array.isArray(raw.result) ? raw.result : Array.isArray(raw) ? raw : [];
    return list
      .filter((item) => isMediaUrl(item?.url))
      .map((item) => ({
        label: 'Instagram media',
        type: classifyMedia({ url: item.url, label: 'video' }, 'video'),
        url: item.url,
      }));
  }

  if (platformKey === 'twitter' || platformKey === 'twitter/x') {
    const variants = Array.isArray(raw.url) ? raw.url : [];
    return variants.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      return Object.entries(entry)
        .filter(([, url]) => isMediaUrl(url))
        .map(([quality, url]) => ({ label: quality.toUpperCase(), type: 'video', url }));
    });
  }

  if (platformKey === 'pinterest') {
    const layer = raw.result && typeof raw.result === 'object' ? raw.result : raw;
    const pin = layer.result && typeof layer.result === 'object' && !Array.isArray(layer.result)
      ? layer.result
      : layer;
    const images = pin.images && typeof pin.images === 'object' ? pin.images : {};
    const imageUrl = images.orig?.url
      ?? images['736x']?.url
      ?? images['600x315']?.url
      ?? pin.image_url
      ?? pin.image
      ?? null;
    return [
      ...(isMediaUrl(pin.video_url) ? [{ label: 'Video', type: 'video', url: pin.video_url }] : []),
      ...(isMediaUrl(imageUrl) ? [{ label: 'Image', type: 'image', url: imageUrl }] : []),
    ];
  }

  return [];
}

function classifyMedia(item, fallback = 'video') {
  const declared = String(item?.type ?? '').toLowerCase();
  if (['video', 'image', 'audio'].includes(declared)) return declared;

  const label = String(item?.label ?? '').toLowerCase();
  if (/(image|photo|picture|thumbnail)/.test(label)) return 'image';
  if (/(audio|mp3|music|song)/.test(label)) return 'audio';
  if (/(video|mp4)/.test(label)) return 'video';

  const url = String(item?.url ?? '');
  const path = (() => {
    try { return new URL(url).pathname.toLowerCase(); }
    catch { return url.toLowerCase().split('?')[0]; }
  })();
  if (/\.(jpe?g|png|gif|webp|avif)$/i.test(path)) return 'image';
  if (/\.(mp3|m4a|aac|ogg|wav|opus)$/i.test(path)) return 'audio';
  if (/\.(mp4|webm|mov|m4v|mkv)$/i.test(path)) return 'video';
  return fallback;
}

function normalizeMediaItems(data, fallbackType = 'video', platform = '') {
  const normalized = getNormalizedItems(data);
  const items = normalized.length ? normalized : getRawMediaItems(data, platform);
  return items
    .filter((item) => isMediaUrl(item?.url))
    .map((item) => {
      const type = classifyMedia(item, fallbackType);
      const mimeType = String(item?.mimetype ?? item?.mimeType ?? (
        type === 'image' ? 'image/jpeg' : type === 'audio' ? 'audio/mpeg' : 'video/mp4'
      ));
      return {
        label: item?.label ?? (type === 'image' ? 'Image' : type === 'audio' ? 'Audio' : 'Video'),
        type,
        mimeType,
        url: item.url,
      };
    });
}

async function btchDownload(platform, sourceUrl) {
  const endpoint = withUrl(BTCH_API_BASE + '/api/download/' + platform, sourceUrl);
  const data = await requestJson(endpoint);
  if (!data || data.success !== true) {
    const detail = data?.error?.message ?? data?.error ?? 'Respons API tidak valid.';
    throw new Error('btch-downloader API: ' + String(detail));
  }
  return data;
}

function buildMediaResponse(data, platform, fallbackType = 'video') {
  const medias = normalizeMediaItems(data, fallbackType, platform);
  if (!medias.length) {
    throw new Error(platform + ' tidak mengembalikan tautan media yang bisa diunduh.');
  }

  return {
    result: {
      title: data?.normalized?.title ?? getRawResult(data).title ?? null,
      author: data?.normalized?.author ?? getRawResult(data).author ?? null,
      medias,
    },
  };
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
  async function capcut(url) {
    const endpoint = withUrl(CAPCUT_API_BASE + '/api/d/capcut', url);
    const data = await requestJson(endpoint);
    const payload = data?.data ?? data?.result ?? data;
    return { result: payload };
  }

  async function tikwm(url) {
    const endpoint = withUrl(TIKWM, url);
    endpoint.searchParams.set('hd', '1');
    return normalizeTikwm(await requestJson(endpoint));
  }

  async function instagram(url) {
    const data = await btchDownload('instagram', normalizeInstagramUrl(url));
    return buildMediaResponse(data, 'Instagram');
  }

  async function youtube(url) {
    const data = await btchDownload('youtube', normalizeYouTubeUrl(url));
    const normalized = normalizeMediaItems(data, 'video', 'youtube');
    const raw = getRawResult(data);
    const video = normalized.find((item) => item.type === 'video')?.url
      ?? (isMediaUrl(raw.mp4) ? raw.mp4 : null);
    if (!video) throw new Error('YouTube tidak mengembalikan tautan video MP4.');
    return {
      result: {
        title: data?.normalized?.title ?? raw.title ?? 'YouTube',
        video,
        medias: [{ label: 'MP4 Video', type: 'video', mimeType: 'video/mp4', url: video }],
      },
    };
  }

  async function youtubeMp3(url) {
    const data = await btchDownload('youtube', normalizeYouTubeUrl(url));
    const normalized = normalizeMediaItems(data, 'video', 'youtube');
    const raw = getRawResult(data);
    const audio = normalized.find((item) => item.type === 'audio')?.url
      ?? (isMediaUrl(raw.mp3) ? raw.mp3 : null);
    if (!audio) throw new Error('YouTube tidak mengembalikan tautan audio MP3.');
    return { result: { audio } };
  }

  async function pinterest(url) {
    const data = await btchDownload('pinterest', normalizePinterestUrl(url));
    return buildMediaResponse(data, 'Pinterest');
  }

  async function twitter(url) {
    const data = await btchDownload('twitter', normalizeTwitterUrl(url));
    return buildMediaResponse(data, 'Twitter/X');
  }

  return Object.freeze({
    tiktok: tikwm,
    youtube,
    youtubeMp3,
    instagram,
    pinterest,
    capcut,
    twitter,
  });
}
