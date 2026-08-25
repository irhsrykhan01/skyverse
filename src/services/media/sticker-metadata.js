import { Image } from 'node-webpmux';

function buildExif(packname, author) {
  const data = JSON.stringify({
    'sticker-pack-id': 'com.skyverse.sticker',
    'sticker-pack-name': packname,
    'sticker-pack-publisher': author,
    'emojis': [],
    'android-app-store-link': '',
    'ios-app-store-link': '',
    'website': '',
  });
  const json = Buffer.from(data, 'utf8');
  const header = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);
  const exif = Buffer.concat([header, json]);
  exif.writeUInt32LE(json.length, 14);
  return exif;
}

export async function addExif(buffer, { packname, author }) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new Error('Data sticker kosong atau tidak valid.');
  const pack = String(packname ?? '').trim().slice(0, 100);
  const publisher = String(author ?? '').trim().slice(0, 100);
  if (!pack) throw new Error('Nama pack wajib diisi.');
  if (!publisher) throw new Error('Author wajib diisi.');

  try {
    const image = new Image();
    await image.load(buffer);
    image.exif = buildExif(pack, publisher);
    const output = await image.save(null);
    if (!Buffer.isBuffer(output) || output.length < 16) throw new Error('Metadata sticker gagal dibuat.');
    return output;
  } catch (error) {
    throw new Error(`Gagal mengubah metadata sticker: ${error.message}`);
  }
}
