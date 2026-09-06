import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

const CUSTOM_IMAGE_PATH = path.resolve(process.cwd(), 'assets', 'link-preview', 'saweria.jpg');
const CUSTOM_IMAGE_URL = 'https://raw.githubusercontent.com/irhsrykhan01/skyverse/main/assets/link-preview/saweria.jpg';

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

export function loadLocalJpeg(filePath = CUSTOM_IMAGE_PATH) {
  return assertJpeg(fs.readFileSync(filePath), filePath);
}

export async function loadRemoteJpeg(url = CUSTOM_IMAGE_URL) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15_000,
    maxContentLength: 100 * 1024,
    maxBodyLength: 100 * 1024,
  });
  return assertJpeg(Buffer.from(response.data), url);
}

export async function getLinkPreviewThumbnail({ filePath = CUSTOM_IMAGE_PATH, url = CUSTOM_IMAGE_URL } = {}) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Thumbnail belum ditemukan: ${filePath}`);
  }

  return loadLocalJpeg(filePath);
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
