export function createUpscaleProvider({ baseUrl = 'https://cdn.pixelbin.io', cloudName, zoneSlug } = {}) {
  return Object.freeze({
    async upscale(buffer, { scale = 2, filePath = `skyverse-${Date.now()}.jpg` } = {}) {
      if (!cloudName || !zoneSlug) {
        throw new Error('Pixelbin cloudName/zoneSlug belum dikonfigurasi untuk Upscale.media.');
      }
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('Input gambar kosong.');
      if (![2, 4, 8].includes(Number(scale))) throw new Error('Scale upscale harus 2, 4, atau 8.');

      // Official Upscale.media docs expose a Pixelbin CDN transformation URL.
      // The source image must already exist at the configured Pixelbin filePath.
      const url = `${baseUrl.replace(/\/$/, '')}/v2/${encodeURIComponent(cloudName)}/${encodeURIComponent(zoneSlug)}/sr.upscale()/` + encodeURIComponent(filePath);
      const response = await fetch(url);
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Upscale.media gagal (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`);
      }
      return Buffer.from(await response.arrayBuffer());
    },
  });
}
