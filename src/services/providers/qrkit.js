const DEFAULT_BASE_URL = 'https://qrkit.tools/api/qr';

export function createQrProvider({ baseUrl = DEFAULT_BASE_URL } = {}) {
  return Object.freeze({
    async generate(data, { size = 512, format = 'png', ecc = 'H' } = {}) {
      const value = String(data ?? '').trim();
      if (!value) throw new Error('Teks atau URL QR tidak boleh kosong.');
      if (value.length > 2048) throw new Error('Isi QR terlalu panjang (maksimum 2048 karakter).');
      const url = new URL(baseUrl);
      url.searchParams.set('data', value);
      url.searchParams.set('size', String(Math.max(64, Math.min(1024, Number(size) || 512))));
      url.searchParams.set('format', format === 'svg' ? 'svg' : 'png');
      url.searchParams.set('ecc', ['L', 'M', 'Q', 'H'].includes(String(ecc).toUpperCase()) ? String(ecc).toUpperCase() : 'H');

      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`QR provider gagal (${response.status}).`);
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('image/')) throw new Error('QR provider tidak mengembalikan gambar.');
      return Buffer.from(await response.arrayBuffer());
    },
  });
}
