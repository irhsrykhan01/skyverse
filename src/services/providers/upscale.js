export function createUpscaleProvider({ baseUrl = 'https://api.upscale.media/v1', apiKey } = {}) {
  return Object.freeze({
    async upscale(buffer, { scale = 2, filename = 'image.jpg', mimeType = 'image/jpeg' } = {}) {
      if (!apiKey) throw new Error('UPSCALE_API_KEY belum dikonfigurasi.');
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('Input gambar kosong.');

      const form = new FormData();
      form.append('image', new Blob([buffer], { type: mimeType }), filename);
      form.append('scale', String(scale));

      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/upscale`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Upscale provider gagal (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.startsWith('image/')) return Buffer.from(await response.arrayBuffer());

      const payload = await response.json();
      const url = payload?.result?.url ?? payload?.url ?? payload?.output_url;
      if (!url) throw new Error('Upscale provider tidak mengembalikan gambar.');

      const media = await fetch(url);
      if (!media.ok) throw new Error(`Gagal mengambil hasil upscale (${media.status}).`);
      return Buffer.from(await media.arrayBuffer());
    },
  });
}
