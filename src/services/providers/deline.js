import { buildUrl, ensureProviderSuccess, requestResource } from './http.js';

export function createDelineProvider({ baseUrl = 'https://api.deline.web.id' } = {}) {
  const call = async (path, params = {}) => ensureProviderSuccess(
    await requestResource(buildUrl(baseUrl, path, params), { retries: 2 }),
    'deline',
  );

  return Object.freeze({
    call,
    youtube: (url) => call('/downloader/youtube', { url }),
    youtubeMp3: (url) => call('/downloader/youtube', { url, type: 'audio' }),
    facebook: (url) => call('/downloader/facebook', { url }),
    pinterest: (url) => call('/downloader/pinterest', { url }),
    twitter: (url) => call('/downloader/twitter', { url }),
    mediafire: (url) => call('/downloader/mediafire', { url }),
    googleDrive: (url) => call('/downloader/gdrive', { url }),
    brat: (text) => call('/maker/brat', { text }),
    bratVideo: (text) => call('/maker/bratvid', { text }),
    iqc: (text, time) => call('/maker/iqc', { text, chatTime: time, statusBarTime: time }),
  });
}
