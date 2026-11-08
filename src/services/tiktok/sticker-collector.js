import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const CACHE_DIR = resolve(process.cwd(), 'data', 'tiktok-stickers');
const INDEX_PATH = join(CACHE_DIR, 'index.json');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_PAGE_BYTES = 6 * 1024 * 1024;
const MAX_ASSET_BYTES = 3 * 1024 * 1024;
const MAX_TRENDING_VIDEOS = 3;
const MAX_COMMENTS_PER_VIDEO = 25;
const MAX_STICKERS_PER_SCAN = 10;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let activeRefresh = null;
let workerStop = null;

function emptyIndex() {
  return {
    version: 1,
    updatedAt: null,
    items: [],
    stats: { scannedVideos: 0, stickerComments: 0, assetUrls: 0, downloaded: 0 },
    lastError: null,
  };
}

async function readIndex() {
  try {
    const parsed = JSON.parse(await readFile(INDEX_PATH, 'utf8'));
    if (!parsed || !Array.isArray(parsed.items)) return emptyIndex();
    return { ...emptyIndex(), ...parsed, stats: { ...emptyIndex().stats, ...(parsed.stats ?? {}) } };
  } catch {
    return emptyIndex();
  }
}

async function writeIndex(index) {
  await mkdir(CACHE_DIR, { recursive: true });
  const temporaryPath = INDEX_PATH + '.tmp';
  await writeFile(temporaryPath, JSON.stringify(index, null, 2));
  await rename(temporaryPath, INDEX_PATH);
}

async function readLimitedBody(response, limit) {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > limit) throw new Error('Respons TikTok melewati batas ukuran yang diizinkan.');
    return buffer;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) {
      await response.body.cancel().catch(() => {});
      throw new Error('Respons TikTok melewati batas ukuran yang diizinkan.');
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, size);
}

async function requestBuffer(url, { referer = 'https://www.tiktok.com/', maxBytes = MAX_PAGE_BYTES, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/json,image/avif,image/webp,image/apng,*/*',
        'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        referer,
      },
    });

    if (!response.ok) throw new Error('TikTok mengembalikan HTTP ' + response.status + '.');
    return {
      buffer: await readLimitedBody(response, maxBytes),
      contentType: String(response.headers.get('content-type') ?? '').toLowerCase(),
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Permintaan ke TikTok timeout.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function discoverTrendingVideoIds() {
  // Explore/FYP sering mengirim shell HTML tanpa data video pada request server-side.
  // Hashtag publik menjadi fallback agar collector tetap punya sumber discovery.
  const pages = [
    'https://www.tiktok.com/explore?lang=id-ID',
    'https://www.tiktok.com/foryou?lang=id-ID',
    'https://www.tiktok.com/tag/memeindonesia?lang=id-ID',
    'https://www.tiktok.com/tag/stikerwa?lang=id-ID',
    'https://www.tiktok.com/tag/meme?lang=id-ID',
    'https://www.tiktok.com/tag/lucu?lang=id-ID',
  ];
  const ids = new Set();
  const errors = [];

  for (const page of pages) {
    try {
      const result = await requestBuffer(page, { maxBytes: MAX_PAGE_BYTES });
      const html = result.buffer.toString('utf8').replaceAll('\\/', '/');
      const patterns = [
        /\/video\/(\d{15,22})/g,
        /"aweme_id"\s*:\s*"?([0-9]{15,22})"?/g,
        /"itemId"\s*:\s*"?([0-9]{15,22})"?/g,
      ];
      for (const pattern of patterns) {
        for (const match of html.matchAll(pattern)) ids.add(match[1]);
      }

      if (ids.size >= MAX_TRENDING_VIDEOS) break;
    } catch (error) {
      errors.push(error?.message ?? String(error));
    }
  }

  if (!ids.size) {
    const detail = errors.length ? errors[errors.length - 1] : 'TikTok mengirim halaman tanpa ID video publik.';
    throw new Error('Sumber Explore dan hashtag publik TikTok belum menyediakan daftar video. ' + detail);
  }

  return [...ids].slice(0, MAX_TRENDING_VIDEOS);
}

function findCommentArrays(value, found = [], depth = 0) {
  if (!value || typeof value !== 'object' || depth > 8) return found;
  if (Array.isArray(value)) {
    for (const entry of value) findCommentArrays(entry, found, depth + 1);
    return found;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === 'comments' && Array.isArray(child)) found.push(child);
    else if (child && typeof child === 'object') findCommentArrays(child, found, depth + 1);
  }
  return found;
}

async function fetchComments(videoId) {
  const endpoint = new URL('https://www.tiktok.com/api/comment/list/');
  const params = {
    aid: '1988',
    app_name: 'tiktok_web',
    aweme_id: videoId,
    count: String(MAX_COMMENTS_PER_VIDEO),
    cursor: '0',
    device_platform: 'web_pc',
    region: 'ID',
    browser_language: 'id-ID',
    browser_platform: 'Win32',
    browser_name: 'Mozilla',
    browser_version: '5.0',
    channel: 'tiktok_web',
    cookie_enabled: 'true',
    screen_width: '1366',
    screen_height: '768',
    tz_name: 'Asia/Jakarta',
    webcast_language: 'id-ID',
  };
  for (const [key, value] of Object.entries(params)) endpoint.searchParams.set(key, value);

  const response = await requestBuffer(endpoint.toString(), {
    referer: 'https://www.tiktok.com/',
    maxBytes: 3 * 1024 * 1024,
  });

  let payload;
  try {
    payload = JSON.parse(response.buffer.toString('utf8'));
  } catch {
    throw new Error('TikTok tidak mengembalikan data komentar JSON yang valid.');
  }

  const arrays = findCommentArrays(payload);
  return arrays.flat().slice(0, MAX_COMMENTS_PER_VIDEO);
}

function findStickerUrls(value, output = [], depth = 0) {
  if (!value || typeof value !== 'object' || depth > 10) return output;
  if (Array.isArray(value)) {
    for (const entry of value) findStickerUrls(entry, output, depth + 1);
    return output;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
    const isAnimatedField = normalizedKey.includes('stickeranimatedurl')
      || normalizedKey.includes('animatedstickerurl')
      || normalizedKey.includes('animatedstickeruri');
    const isStickerUrlField = normalizedKey.includes('stickerurl')
      || normalizedKey.includes('stickeruri')
      || normalizedKey.includes('stickerimagesrc');

    if ((isAnimatedField || isStickerUrlField) && typeof child === 'string' && /^https?:\/\//i.test(child)) {
      output.push({ url: child, animated: isAnimatedField });
    } else if (child && typeof child === 'object') {
      findStickerUrls(child, output, depth + 1);
    }
  }
  return output;
}

function isAllowedStickerHost(hostname) {
  const host = String(hostname).toLowerCase();
  const domains = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokv.com', 'byteoversea.com', 'ibytedtos.com', 'muscdn.com'];
  return domains.some((domain) => host === domain || host.endsWith('.' + domain));
}

function isAnimatedWebp(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 20) return false;
  if (buffer.subarray(0, 4).toString('ascii') !== 'RIFF' || buffer.subarray(8, 12).toString('ascii') !== 'WEBP') return false;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > buffer.length) return false;
    if (type === 'ANIM' || type === 'ANMF') return true;
    if (type === 'VP8X' && size >= 1 && (buffer[dataStart] & 0x02)) return true;
    offset = dataEnd + (size & 1);
  }
  return false;
}

function guessExtension(url, contentType, buffer) {
  const type = String(contentType).split(';')[0].trim();
  const known = new Map([
    ['image/webp', '.webp'],
    ['image/gif', '.gif'],
    ['image/png', '.png'],
    ['image/jpeg', '.jpg'],
    ['image/jpg', '.jpg'],
    ['video/mp4', '.mp4'],
  ]);
  if (known.has(type)) return known.get(type);

  const urlExtension = extname(new URL(url).pathname).toLowerCase();
  if (['.webp', '.gif', '.png', '.jpg', '.jpeg', '.mp4'].includes(urlExtension)) return urlExtension;
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return '.webp';
  if (buffer.subarray(0, 3).toString('ascii') === 'GIF') return '.gif';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return '.png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length > 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') return '.mp4';
  return null;
}

async function downloadSticker(candidate) {
  let parsed;
  try {
    parsed = new URL(candidate.url);
  } catch {
    throw new Error('URL stiker tidak valid.');
  }

  if (parsed.protocol !== 'https:' || !isAllowedStickerHost(parsed.hostname)) {
    throw new Error('Host file stiker bukan CDN TikTok yang diizinkan.');
  }

  const response = await requestBuffer(parsed.toString(), {
    referer: 'https://www.tiktok.com/',
    maxBytes: MAX_ASSET_BYTES,
    timeoutMs: 8000,
  });

  const extension = guessExtension(parsed.toString(), response.contentType, response.buffer);
  if (!extension || (!response.contentType.startsWith('image/') && !response.contentType.startsWith('video/') && !['.webp', '.gif', '.png', '.jpg', '.jpeg', '.mp4'].includes(extension))) {
    throw new Error('File dari TikTok bukan gambar atau animasi yang didukung.');
  }

  const id = createHash('sha256').update(candidate.url).digest('hex').slice(0, 24);
  const filename = id + extension;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(join(CACHE_DIR, filename), response.buffer);

  const animated = Boolean(candidate.animated)
    || extension === '.gif'
    || extension === '.mp4'
    || (extension === '.webp' && isAnimatedWebp(response.buffer));

  return {
    id,
    file: filename,
    animated,
    mime: response.contentType || 'application/octet-stream',
    occurrences: candidate.occurrences,
    likes: candidate.likes,
    sourceVideoId: candidate.sourceVideoId,
    cachedAt: Date.now(),
  };
}

async function refreshInternal() {
  const previous = await readIndex();
  const stats = { scannedVideos: 0, stickerComments: 0, assetUrls: 0, downloaded: 0 };
  const aggregated = new Map();
  let lastError = null;

  try {
    const videoIds = await discoverTrendingVideoIds();
    for (const videoId of videoIds) {
      stats.scannedVideos += 1;
      try {
        const comments = await fetchComments(videoId);
        for (const comment of comments) {
          const text = String(comment?.text ?? comment?.content ?? '');
          if (/\[sticker\]/i.test(text)) stats.stickerComments += 1;

          const candidates = findStickerUrls(comment);
          for (const candidate of candidates) {
            let entry = aggregated.get(candidate.url);
            if (!entry) {
              entry = {
                url: candidate.url,
                animated: candidate.animated,
                occurrences: 0,
                likes: 0,
                sourceVideoId: videoId,
              };
              aggregated.set(candidate.url, entry);
            }
            entry.occurrences += 1;
            entry.likes += Math.max(0, Number(comment?.digg_count ?? comment?.like_count ?? comment?.likes ?? 0) || 0);
            entry.animated ||= candidate.animated;
          }
        }
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    }

    const candidates = [...aggregated.values()]
      .sort((a, b) => b.occurrences - a.occurrences || b.likes - a.likes)
      .slice(0, MAX_STICKERS_PER_SCAN);
    stats.assetUrls = candidates.length;

    const downloaded = [];
    for (const candidate of candidates) {
      try {
        downloaded.push(await downloadSticker(candidate));
        stats.downloaded += 1;
      } catch (error) {
        lastError = error;
      }
    }

    const merged = new Map(previous.items.map((item) => [item.id, item]));
    for (const item of downloaded) merged.set(item.id, item);
    const items = [...merged.values()]
      .sort((a, b) => Number(b.occurrences ?? 0) - Number(a.occurrences ?? 0) || Number(b.likes ?? 0) - Number(a.likes ?? 0))
      .slice(0, 60);

    const result = {
      version: 1,
      updatedAt: Date.now(),
      items,
      stats,
      lastError: lastError?.message ?? null,
    };
    await writeIndex(result);
    return result;
  } catch (error) {
    const result = {
      ...previous,
      // Preserve the last successful timestamp so the next command can retry discovery.
      updatedAt: previous.updatedAt,
      stats,
      lastError: error?.message ?? String(error),
    };
    await writeIndex(result);
    return result;
  }
}

export function refreshTikTokStickerLibrary() {
  if (activeRefresh) return activeRefresh;
  activeRefresh = refreshInternal().finally(() => {
    activeRefresh = null;
  });
  return activeRefresh;
}

export async function getTikTokStickerLibrary({ refreshIfStale = true } = {}) {
  const index = await readIndex();
  const isStale = !index.updatedAt || Date.now() - Number(index.updatedAt) >= CACHE_TTL_MS;
  if (!refreshIfStale || !isStale) return index;
  return refreshTikTokStickerLibrary();
}

export function startTikTokStickerCollector({ logger } = {}) {
  if (workerStop) return workerStop;

  let stopped = false;
  const run = async () => {
    if (stopped) return;
    const result = await refreshTikTokStickerLibrary();
    const downloaded = Number(result.stats?.downloaded ?? 0);
    if (downloaded > 0) logger?.info?.('TikTok Sticker Collector menyimpan ' + downloaded + ' stiker baru.');
    else logger?.warn?.('TikTok Sticker Collector belum menemukan URL file stiker publik. ' + (result.lastError ?? 'Metadata stiker tidak tersedia.'));
  };

  const initialTimer = setTimeout(() => {
    run().catch((error) => logger?.warn?.('TikTok Sticker Collector gagal: ' + (error?.message ?? error)));
  }, 60 * 1000);
  initialTimer.unref?.();

  const interval = setInterval(() => {
    run().catch((error) => logger?.warn?.('TikTok Sticker Collector gagal: ' + (error?.message ?? error)));
  }, CACHE_TTL_MS);
  interval.unref?.();

  workerStop = () => {
    stopped = true;
    clearTimeout(initialTimer);
    clearInterval(interval);
    workerStop = null;
  };
  return workerStop;
}

export const TIKTOK_STICKER_CACHE_DIR = CACHE_DIR;
export const TIKTOK_STICKER_CACHE_TTL_MS = CACHE_TTL_MS;
