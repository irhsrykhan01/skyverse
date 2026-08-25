export function createRemoveBgProvider({ baseUrl = 'https://clearbackdrop.com/api/v1' } = {}) {
  return Object.freeze({
    async remove(buffer, { filename = 'image.jpg', mimeType = 'image/jpeg' } = {}) {
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('Input gambar kosong.');

      const form = new FormData();
      form.append('image', new Blob([buffer], { type: mimeType }), filename);

      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/remove-background`, {
        method: 'POST',
        body: form,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`ClearBackdrop gagal (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) {
        throw new Error('ClearBackdrop tidak mengembalikan PNG hasil remove background.');
      }

      const output = Buffer.from(await response.arrayBuffer());
      if (output.length === 0) throw new Error('ClearBackdrop mengembalikan file kosong.');
      return output;
    },
  });
}
