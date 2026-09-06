import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

// Replace this file with the final 1:1 JPEG thumbnail when ready.
const DEFAULT_IMAGE_PATH = path.resolve(process.cwd(), 'banner_skylabs.jpg');
const DEFAULT_IMAGE_URL = 'https://raw.githubusercontent.com/irhsrykhan01/skyverse/main/banner_skylabs.jpg';

function assertJpeg(buffer, source) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error(`Thumbnail dari ${source} bukan Buffer yang valid.`);
  }

  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) {
    throw new Error(`Thumbnail dari ${source} bukan file JPEG/JPG yang valid.`);
  }

  if (buffer.length >= 100 * 1024) {
    throw new Error(`Thumbnail dari ${source} terlalu besar. Gunakan JPEG di bawah 100 KB.`);
  }

  return buffer;
}

export function loadLocalJpeg(filePath = DEFAULT_IMAGE_PATH) {
  return assertJpeg(fs.readFileSync(filePath), filePath);
}

export async function loadRemoteJpeg(url = DEFAULT_IMAGE_URL) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15_000,
    maxContentLength: 100 * 1024,
    maxBodyLength: 100 * 1024,
  });
  return assertJpeg(Buffer.from(response.data), url);
}

export async function getLinkPreviewThumbnail({ filePath = DEFAULT_IMAGE_PATH, url = DEFAULT_IMAGE_URL } = {}) {
  try {
    if (fs.existsSync(filePath)) return loadLocalJpeg(filePath);
  } catch (error) {
    console.warn(`[link-preview] Local thumbnail gagal: ${error.message}`);
  }

  return loadRemoteJpeg(url);
}

export async function sendLinkPreview(sock, jid, {
  url,
  title,
  description,
  imageBuffer,
  text,
}) {
  try {
    const thumbnail = imageBuffer ?? await getLinkPreviewThumbnail();

    return await sock.sendMessage(jid, {
      text: text ?? `${title}\n${url}`,
      linkPreview: {
        'canonical-url': url,
        'matched-url': url,
        title,
        description,
        jpegThumbnail: thumbnail,
      },
    });
  } catch (error) {
    throw new Error(`Gagal mengirim link preview: ${error?.message ?? String(error)}`);
  }
}
