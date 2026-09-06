import fs from 'node:fs';

const DEFAULT_IMAGE_PATH = './assets/link-preview/saweria.jpg';

function readThumbnail(filePath = DEFAULT_IMAGE_PATH) {
  const imageBuffer = fs.readFileSync(filePath);

  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error(`Thumbnail tidak valid: ${filePath}`);
  }

  return imageBuffer;
}

export function sendLinkPreview(sock, jid, {
  url,
  title,
  description,
  imagePath = DEFAULT_IMAGE_PATH,
  text,
}) {
  const thumbnail = readThumbnail(imagePath);

  return sock.sendMessage(jid, {
    text: text ?? `${title}\n${url}`,
    contextInfo: {
      externalAdReply: {
        title,
        body: description,
        mediaType: 1,
        previewType: 'NONE',
        thumbnail,
        renderLargerThumbnail: true,
        sourceUrl: url,
      },
    },
  });
}
