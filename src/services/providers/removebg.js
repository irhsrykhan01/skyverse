export function createRemoveBgProvider({ apiKey, baseUrl = 'https://api.remove.bg/v1.0' }) {
  return Object.freeze({
    async remove(buffer, { filename = 'image.jpg', mimeType = 'image/jpeg', size = 'auto' } = {}) {
      if (!apiKey) throw new Error('REMOVE_BG_API_KEY belum dikonfigurasi.');
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('Input gambar kosong.');

      const form = new FormData();
      form.append('image_file', new Blob([buffer], { type: mimeType }), filename);
      form.append('size', size);

      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/removebg`, {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: form,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`remove.bg gagal (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`);
      }

      return Buffer.from(await response.arrayBuffer());
    },
  });
}
