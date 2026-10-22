import { downloadMediaSource, findMediaSource } from '../../services/providers/media-response.js';
import { findDownloaderUrls, replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

export async function sendVisualDownload(ctx, response) {
  const videos = findDownloaderUrls(response, { kind: 'video' });
  const images = findDownloaderUrls(response, { kind: 'image' });
  if (videos.length) return replyWithDownloaderMedia(ctx, { result: { video: videos[0] } }, { kind: 'video' });
  if (images.length) return replyWithDownloaderMedia(ctx, { result: { image: images[0] } }, { kind: 'image' });
  throw new Error('Provider tidak mengembalikan media visual yang dapat dikirim.');
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
