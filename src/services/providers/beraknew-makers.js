import { buildUrl, requestResource } from './http.js';
import { findMediaSource, downloadMediaSource } from './media-response.js';

function imageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export function createBerakNewMakerProvider({
  baseUrl = 'https://api.beraknew.web.id/api',
  apiKey = null,
} = {}) {
  async function fakeDana(nominal) {
    const value = String(nominal ?? '').trim();
    if (!value) throw new Error('USER_INPUT:Masukkan nominal saldo contoh.');
    if (!apiKey) {
      throw new Error('USER_INPUT:API key maker belum dikonfigurasi. Isi BERAKNEW_API_KEY di file .env.');
    }

    const response = await requestResource(buildUrl(baseUrl, '/maker/fake-dana', { nominal: value }), {
      headers: { 'X-Api-Key': apiKey },
      timeout: 45_000,
      retries: 1,
      maxBytes: 12 * 1024 * 1024,
    });
    const buffer = Buffer.isBuffer(response)
      ? response
      : await downloadMediaSource(findMediaSource(response, { baseUrl }), {
        expectedType: 'image',
        maxBytes: 12 * 1024 * 1024,
      });
    const mimetype = imageType(buffer);
    if (!mimetype) throw new Error('API fake-dana tidak mengembalikan file gambar yang valid.');
    return { buffer, mimetype };
  }

  return Object.freeze({ fakeDana });
}
