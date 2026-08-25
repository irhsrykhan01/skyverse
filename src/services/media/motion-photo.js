const XMP_PATTERNS = [
  /MicroVideoOffset["'=:\s]+(\d+)/i,
  /MicroVideoOffset[^>]*>(\d+)</i,
  /GCamera:MicroVideoOffset["'=:\s]+(\d+)/i,
];

function readUInt32BE(buffer, offset) {
  if (offset + 4 > buffer.length) return null;
  return buffer.readUInt32BE(offset);
}

function findJpegEnd(buffer) {
  if (buffer.length < 2 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return -1;
  for (let i = 2; i < buffer.length - 1; i += 1) {
    if (buffer[i] !== 0xff) continue;
    const marker = buffer[i + 1];
    if (marker === 0xd9) return i + 2;
    if (marker === 0xda) {
      for (let j = i + 2; j < buffer.length - 1; j += 1) {
        if (buffer[j] === 0xff && buffer[j + 1] === 0xd9) return j + 2;
      }
      return -1;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = buffer.readUInt16BE(i + 2);
    if (length < 2) return -1;
    i += length;
  }
  return -1;
}

function findOffsetFromXmp(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 512 * 1024)).toString('latin1');
  for (const pattern of XMP_PATTERNS) {
    const match = sample.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function findFtyp(buffer, start) {
  for (let i = Math.max(0, start); i <= buffer.length - 8; i += 1) {
    if (buffer.toString('ascii', i + 4, i + 8) === 'ftyp') return i;
  }
  return -1;
}

export function extractMotionPhoto(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;
  const jpegEnd = findJpegEnd(buffer);
  if (jpegEnd < 0) return null;

  const offset = findOffsetFromXmp(buffer);
  let videoStart = -1;
  if (Number.isInteger(offset) && offset > 0 && offset < buffer.length) {
    videoStart = buffer.length - offset;
  }
  if (videoStart < jpegEnd || buffer.toString('ascii', videoStart + 4, videoStart + 8) !== 'ftyp') {
    videoStart = findFtyp(buffer, jpegEnd);
  }
  if (videoStart < 0 || videoStart <= jpegEnd || videoStart >= buffer.length) return null;

  const video = buffer.subarray(videoStart);
  if (readUInt32BE(video, 0) === null) return null;

  return {
    image: buffer.subarray(0, jpegEnd),
    video,
    videoOffset: videoStart,
    isMotionPhoto: true,
  };
}
