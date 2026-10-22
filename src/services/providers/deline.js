import { buildUrl, requestResource } from './http.js';

export function createDelineProvider({ baseUrl = 'https://api.deline.web.id' } = {}) {
  const call = (path, params = {}) => requestResource(buildUrl(baseUrl, path, params), { retries: 2 });

  return Object.freeze({
    call,
    youtube: (url) => call('/downloader/youtube', { url }),
    youtubeMp3: (url) => call('/downloader/youtube', { url, type: 'audio' }),
    facebook: (url) => call('/downloader/facebook', { url }),
    pinterest: (url) => call('/downloader/pinterest', { url }),
    twitter: (url) => call('/downloader/twitter', { url }),
    mediafire: (url) => call('/downloader/mediafire', { url }),
    googleDrive: (url) => call('/downloader/googledrive', { url }),
    brat: (text) => call('/maker/brat', { text }),
    bratVideo: (text) => call('/maker/bratvid', { text }),
    iqc: (text, time) => call('/maker/iqc', { text, chatTime: time, statusBarTime: time }),
  });
}
