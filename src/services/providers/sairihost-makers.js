import { buildUrl, requestResource, ensureProviderSuccess } from './http.js';

function imageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, 6).toString('ascii').startsWith('GIF8')) return 'image/gif';
  return null;
}

export function createSairiHostMakerProvider({
  baseUrl = 'https://api.sairihost.com',
  apiKey = null,
} = {}) {
  async function requestImage(path, params) {
    if (!apiKey) {
      throw new Error('USER_INPUT:API key maker belum dikonfigurasi. Isi SAIRIHOST_API_KEY di file .env.');
    }

    const response = ensureProviderSuccess(await requestResource(buildUrl(baseUrl, path, params), {
      headers: { 'X-Api-Key': apiKey },
      timeout: 45_000,
      retries: 1,
      maxBytes: 12 * 1024 * 1024,
    }), 'SairiHost maker');
    const mimetype = imageType(response);
    if (!mimetype) {
      const detail = response && typeof response === 'object'
        ? response.message ?? response.error?.message ?? response.error
        : null;
      throw new Error(detail ? `SairiHost maker: ${detail}` : 'API maker tidak mengembalikan file gambar yang valid.');
    }
    return { buffer: response, mimetype };
  }

  function fakeCall(name, duration = '', url = '') {
    const value = String(name ?? '').trim();
    if (!value) throw new Error('USER_INPUT:Nama pemanggil wajib diisi.');
    return requestImage('/api/maker/fakecall', { name: value, duration, url });
  }

  function fakeChannel(name, followers = '', time = '') {
    const value = String(name ?? '').trim();
    if (!value) throw new Error('USER_INPUT:Nama channel wajib diisi.');
    return requestImage('/api/maker/fakech', { name: value, followers, time });
  }

  function fakeTikTokComment(name, comment, videoText = '', likes = '', reply = '') {
    const author = String(name ?? '').trim();
    const message = String(comment ?? '').trim();
    if (!author || !message) throw new Error('USER_INPUT:Nama dan komentar wajib diisi.');
    return requestImage('/api/maker/faketiktok', {
      name: author,
      comment: message,
      video_text: videoText,
      likes,
      reply,
    });
  }

  return Object.freeze({ fakeCall, fakeChannel, fakeTikTokComment });
}
