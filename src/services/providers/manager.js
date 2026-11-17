import { createDepayProvider } from './depay.js';
import { createKeyraDownloaderProvider } from './keyra-downloaders.js';
import { createTikTokWorkerProvider } from './tiktok-worker.js';
import { downloadWithProviderFallback, findDownloaderUrl } from './downloader-response.js';
import { createMakerProvider } from './makers.js';
import { createRemoveBgProvider } from './removebg.js';

function hasUsableMedia(response, kind = 'video') {
  if (Buffer.isBuffer(response) || Buffer.isBuffer(response?.media) || Buffer.isBuffer(response?.result?.media)) return true;
  return Boolean(findDownloaderUrl(response, { kind })
    || (kind === 'audio' && findDownloaderUrl(response, { kind: 'video' })));
}

function describeFailure(providerName, error) {
  return `${providerName}: ${String(error?.message ?? error ?? 'Unknown error').replace(/\s+/g, ' ').trim().slice(0, 220)}`;
}

async function withFallback(providers, { kind = 'video' } = {}) {
  const failures = [];

  for (const provider of providers) {
    try {
      const response = await provider.execute();
      if (!hasUsableMedia(response, kind)) {
        throw new Error(`Respons ${provider.name} tidak berisi URL media ${kind}.`);
      }
      return response;
    } catch (error) {
      failures.push(describeFailure(provider.name, error));
    }
  }

  const error = new Error(`Semua provider gagal: ${failures.join(' | ') || 'provider tidak dikonfigurasi.'}`);
  error.providers = failures;
  throw error;
}

export function createProviderManager(config) {
  const depay = createDepayProvider({ baseUrl: config.depayBaseUrl });
  const keyraDownloader = createKeyraDownloaderProvider({
    apiKey: config.keyraApiKey,
    baseUrl: config.keyraBaseUrl,
  });
  const tiktokWorker = createTikTokWorkerProvider();
  const makers = createMakerProvider({
    bratBaseUrl: config.bratBaseUrl,
    nexrayBaseUrl: config.nexrayBaseUrl,
  });

  const tiktokChain = [
    { name: 'Keyra', execute: (url) => keyraDownloader.tiktok(url) },
    { name: 'TikTok Worker', execute: (url) => tiktokWorker.tiktok(url) },
    { name: 'Depay', execute: (url) => depay.tiktok(url) },
  ];

  const downloader = Object.freeze({
    ...keyraDownloader,
    tiktok: (url) => withFallback(tiktokChain.map((provider) => ({
      name: provider.name,
      execute: () => provider.execute(url),
    }))),
    tiktokMedia: (url, options = {}) => downloadWithProviderFallback(tiktokChain, url, options),
    youtube: (url) => withFallback([
      { name: 'Keyra', execute: () => keyraDownloader.youtube(url) },
      { name: 'Depay', execute: () => depay.youtube(url, 'video') },
    ]),
    youtubeMp3: (url) => withFallback([
      { name: 'Keyra', execute: () => keyraDownloader.youtubeMp3(url) },
      { name: 'Depay', execute: () => depay.youtube(url, 'mp3') },
    ], { kind: 'audio' }),
    instagram: (url) => withFallback([
      { name: 'Keyra', execute: () => keyraDownloader.instagram(url) },
      { name: 'Depay', execute: () => depay.instagram(url) },
    ]),
    facebook: (url) => withFallback([
      { name: 'Keyra', execute: () => keyraDownloader.facebook(url) },
      { name: 'Depay', execute: () => depay.facebook(url) },
    ]),
  });

  const removebg = createRemoveBgProvider({ baseUrl: config.removeBgBaseUrl });

  return Object.freeze({
    depay,
    makers,
    downloader,
    removebg,
  });
}
