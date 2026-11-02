import { downloadMediaSource, findMediaSource } from '../../services/providers/media-response.js';
import {
  findDownloaderUrl,
  findDownloaderUrls,
  replyWithDownloaderAudio,
  replyWithDownloaderMedia,
} from '../../services/providers/downloader-response.js';

export async function sendWithFallback(ctx, providers, send) {
  const errors = [];
  for (const provider of providers) {
    try {
      const response = await provider.run();
      return await send(response);
    } catch (error) {
      errors.push(`${provider.name}: ${String(error?.message ?? error).replace(/\s+/g, ' ').slice(0, 180)}`);
    }
  }
  throw new Error(errors.length
    ? `Semua provider gagal — ${errors.join(' | ')}`
    : 'Tidak ada provider downloader yang dikonfigurasi.');
}

export async function sendVisualDownload(ctx, response) {
  const videos = findDownloaderUrls(response, { kind: 'video' });
  const images = findDownloaderUrls(response, { kind: 'image' });
  let lastError = null;
  if (videos.length) {
    try { return await replyWithDownloaderMedia(ctx, response, { kind: 'video' }); }
    catch (error) { lastError = error; }
  }
  if (images.length) {
    try { return await replyWithDownloaderMedia(ctx, response, { kind: 'image' }); }
    catch (error) { lastError = error; }
  }
  throw lastError ?? new Error('Provider tidak mengembalikan media visual yang dapat dikirim.');
}

export async function sendTikTokDownload(ctx, response) {
  const result = response?.result ?? response?.data ?? response ?? {};
  const video = result.video ?? result.play ?? result.video_url ?? result.videoUrl
    ?? findDownloaderUrl(response, { kind: 'video' });
  if (video) return replyWithDownloaderMedia(ctx, { result: { video } }, { kind: 'video' });

  const images = Array.isArray(result.images) && result.images.length
    ? result.images
    : findDownloaderUrls(response, { kind: 'image' });
  if (!images.length) throw new Error('Provider tidak mengembalikan video atau foto TikTok.');
  for (const url of images.slice(0, 10)) {
    await replyWithDownloaderMedia(ctx, { result: { image: url } }, { kind: 'image' });
  }
}

export async function sendAudioDownload(ctx, response, filename) {
  const audioUrl = findDownloaderUrl(response, { kind: 'audio' });
  if (audioUrl) {
    return replyWithDownloaderAudio(ctx, { result: { audio: audioUrl } }, { filename });
  }

  const videoUrl = findDownloaderUrl(response, { kind: 'video' });
  if (!videoUrl) throw new Error('Provider tidak mengembalikan URL audio atau video yang dapat diproses.');
  const buffer = await downloadMediaSource({ kind: 'url', value: videoUrl }, { expectedType: 'video' });
  const audio = await ctx.media.toMp3(buffer);
  return ctx.media.send(audio, 'audio', { mimetype: 'audio/mpeg', fileName: filename });
}

export async function sendDocumentDownload(ctx, response, fileName) {
  const source = findMediaSource(response?.result ?? response, { baseUrl: ctx.config.delineBaseUrl });
  if (!source) throw new Error('Provider tidak mengembalikan file download.');
  const buffer = await downloadMediaSource(source, { maxBytes: 50 * 1024 * 1024 });
  return ctx.media.send(buffer, 'document', {
    mimetype: 'application/octet-stream',
    fileName,
  });
}
