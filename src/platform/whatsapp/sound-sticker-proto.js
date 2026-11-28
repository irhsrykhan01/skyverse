import { proto } from '@whiskeysockets/baileys';

function readVarint(buffer, offset) {
  let value = 0;
  let shift = 0;
  let position = offset;
  while (position < buffer.length && shift < 56) {
    const byte = buffer[position++];
    value += (byte & 0x7f) * (2 ** shift);
    if ((byte & 0x80) === 0) return { value, offset: position };
    shift += 7;
  }
  throw new Error('WAProto sound sticker: varint tidak valid.');
}

function writeVarint(value) {
  let number = Number(value);
  const bytes = [];
  while (number > 127) {
    bytes.push((number & 0x7f) | 0x80);
    number = Math.floor(number / 128);
  }
  bytes.push(number);
  return Buffer.from(bytes);
}

function writeBytesField(fieldNumber, value) {
  const data = Buffer.from(value);
  return Buffer.concat([writeVarint((fieldNumber << 3) | 2), writeVarint(data.length), data]);
}

function findBytesField(buffer, wantedField) {
  let offset = 0;
  while (offset < buffer.length) {
    const tag = readVarint(buffer, offset);
    offset = tag.offset;
    const field = Math.floor(tag.value / 8);
    const wire = tag.value & 7;
    if (wire === 2) {
      const length = readVarint(buffer, offset);
      offset = length.offset;
      const end = offset + length.value;
      if (end > buffer.length) throw new Error('WAProto sound sticker: panjang field terpotong.');
      const value = buffer.subarray(offset, end);
      if (field === wantedField) return value;
      offset = end;
    } else if (wire === 0) {
      offset = readVarint(buffer, offset).offset;
    } else if (wire === 1) offset += 8;
    else if (wire === 5) offset += 4;
    else throw new Error(`WAProto sound sticker: wire type ${wire} tidak didukung.`);
  }
  return null;
}

function readStickerExtras(stickerBytes) {
  const extras = {};
  let offset = 0;
  while (offset < stickerBytes.length) {
    const tag = readVarint(stickerBytes, offset);
    offset = tag.offset;
    const field = Math.floor(tag.value / 8);
    const wire = tag.value & 7;
    if (wire === 0) {
      const value = readVarint(stickerBytes, offset);
      offset = value.offset;
      if (field === 24) extras.stickerFlags = value.value;
    } else if (wire === 2) {
      const length = readVarint(stickerBytes, offset);
      offset = length.offset;
      const end = offset + length.value;
      if (end > stickerBytes.length) throw new Error('WAProto sound sticker: data sticker terpotong.');
      const value = stickerBytes.subarray(offset, end);
      if (field === 25) extras.stickerEmoji = value.toString('utf8');
      if (field === 26) extras.audioBytes = value;
      offset = end;
    } else if (wire === 1) offset += 8;
    else if (wire === 5) offset += 4;
    else throw new Error(`WAProto sound sticker: wire type ${wire} tidak didukung.`);
  }
  return extras;
}

export function installWAPProtoSoundStickerPatch() {
  const Message = proto?.Message;
  if (!Message?.encode || !Message?.decode || !Message?.fromObject || !Message?.toObject) {
    throw new Error('Baileys WAProto Message API tidak tersedia; sound sticker patch tidak dapat dipasang.');
  }
  if (Message.__skyverseSoundStickerPatched) return true;

  const originalEncode = Message.encode;
  const originalDecode = Message.decode;
  const originalFromObject = Message.fromObject;
  const originalToObject = Message.toObject;

  Message.fromObject = function fromObjectWithSoundSticker(value) {
    const audio = value?.stickerMessage?.audioMessage;
    const emoji = value?.stickerMessage?.stickerEmoji;
    const result = originalFromObject.call(this, value);
    if (audio && result.stickerMessage) {
      result.stickerMessage.audioMessage = Message.AudioMessage.fromObject(audio);
      if (emoji) result.stickerMessage.stickerEmoji = String(emoji);
    }
    return result;
  };

  Message.toObject = function toObjectWithSoundSticker(value, options) {
    const result = originalToObject.call(this, value, options);
    const audio = value?.stickerMessage?.audioMessage;
    const emoji = value?.stickerMessage?.stickerEmoji;
    if (audio && result.stickerMessage) {
      result.stickerMessage.audioMessage = Message.AudioMessage.toObject(audio, options);
      if (emoji) result.stickerMessage.stickerEmoji = emoji;
    }
    return result;
  };

  Message.encode = function encodeWithSoundSticker(value, writer) {
    const sticker = value?.stickerMessage;
    const audio = sticker?.audioMessage;
    if (!sticker || !audio) return originalEncode.call(this, value, writer);

    const { audioMessage, stickerEmoji, ...plainSticker } = sticker;
    const { stickerMessage, ...plainMessage } = value;
    const baseWriter = originalEncode.call(this, plainMessage, writer);
    const stickerWriter = originalEncode.call(this, { stickerMessage: plainSticker });
    const baseStickerBytes = findBytesField(stickerWriter.finish(), 26);
    if (!baseStickerBytes) throw new Error('WAProto sound sticker: stickerMessage gagal dienkode.');

    const audioBytes = Message.AudioMessage.encode(audio).finish();
    const extras = [
      writeVarint((24 << 3) | 0),
      writeVarint(0),
      stickerEmoji ? writeBytesField(25, Buffer.from(String(stickerEmoji), 'utf8')) : null,
      writeBytesField(26, audioBytes),
    ].filter(Boolean);
    const extendedSticker = Buffer.concat([baseStickerBytes, ...extras]);
    const innerMessage = writeBytesField(26, extendedSticker);
    const futureProofWrapper = writeBytesField(1, innerMessage);

    baseWriter.uint32((134 << 3) | 2).bytes(futureProofWrapper);
    return baseWriter;
  };

  Message.decode = function decodeWithSoundSticker(reader, length) {
    const isReader = reader && reader.buf instanceof Uint8Array && Number.isInteger(reader.pos);
    const start = isReader ? reader.pos : 0;
    const rawInput = !isReader && reader instanceof Uint8Array ? Buffer.from(reader) : null;
    const decoded = originalDecode.call(this, reader, length);
    const raw = rawInput ?? (isReader ? Buffer.from(reader.buf.subarray(start, reader.pos)) : null);
    if (!raw) return decoded;

    const wrapperBytes = findBytesField(raw, 134);
    if (!wrapperBytes) return decoded;
    const innerMessageBytes = findBytesField(wrapperBytes, 1);
    if (!innerMessageBytes) return decoded;
    const stickerBytes = findBytesField(innerMessageBytes, 26);
    if (!stickerBytes) return decoded;

    const extras = readStickerExtras(stickerBytes);
    if (extras.audioBytes) {
      const inner = originalDecode.call(this, innerMessageBytes);
      const sticker = inner.stickerMessage;
      if (sticker) {
        sticker.audioMessage = Message.AudioMessage.decode(extras.audioBytes);
        if (extras.stickerEmoji) sticker.stickerEmoji = extras.stickerEmoji;
        decoded.stickerMessage = sticker;
      }
    }
    return decoded;
  };

  Object.defineProperty(Message, '__skyverseSoundStickerPatched', { value: true });
  return true;
}
