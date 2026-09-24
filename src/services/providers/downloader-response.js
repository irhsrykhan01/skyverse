function isLikelyMediaBuffer(buffer, kind, contentType = '') {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return false;
  const mime = String(contentType).toLowerCase();
  if (/text\/(html|plain)|application\/(json|javascript)/i.test(mime)) return false;
  if (kind === 'audio') {
    return buffer.subarray(0, 4).toString('ascii') === 'OggS'
      || buffer.subarray(0, 3).toString('ascii') === 'ID3'
      || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      || buffer.subarray(0, 4).toString('ascii') === 'RIFF';
  }
  return buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    || buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    || buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
}
