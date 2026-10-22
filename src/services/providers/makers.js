import { requestResource } from './http.js';

const MAX_BRAT_TEXT_LENGTH = 250;
const MAX_BRATVID_FRAMES = 24;

function cleanBaseUrl(value) {
  return String(value).replace(/\/+$/, '');
}

async function fallback(tasks) {
  const errors = [];
  for (const task of tasks) {
    try { return await task(); }
    catch (error) { errors.push(error); }
  }
  const error = new Error(errors.at(-1)?.message ?? 'Semua maker provider gagal.');
  error.cause = errors;
  throw error;
}

function validateText(text, label = 'Teks') {
  const value = String(text ?? '').trim();
  if (!value) throw new Error(`${label} tidak boleh kosong.`);
  if (value.length > MAX_BRAT_TEXT_LENGTH) throw new Error(`${label} maksimal ${MAX_BRAT_TEXT_LENGTH} karakter.`);
  return value;
}

export function createMakerProvider({
  bratBaseUrl = 'https://aqul-brat.hf.space',
  nexrayBaseUrl = 'https://api.nexray.web.id',
  deline,
  zenzxz,
} = {}) {
  const aqulBrat = (text) => requestResource(
    `${cleanBaseUrl(bratBaseUrl)}/?text=${encodeURIComponent(text)}`,
    { retries: 2, maxBytes: 12 * 1024 * 1024 },
  );

  const nexrayIqc = (text) => requestResource(
    `${cleanBaseUrl(nexrayBaseUrl)}/maker/iqc?text=${encodeURIComponent(text)}`,
    { retries: 1, maxBytes: 12 * 1024 * 1024 },
  );

  const brat = (text) => {
    const value = validateText(text, 'Teks Brat');
    return fallback([
      () => deline?.brat(value),
      () => zenzxz?.brat(value),
      () => aqulBrat(value),
    ].filter(Boolean));
  };

  const bratFrames = async (text) => {
    const value = validateText(text, 'Teks BratVid');
    const words = value.split(/\s+/).filter(Boolean).slice(0, MAX_BRATVID_FRAMES);
    const phrases = words.length === 1
      ? [words[0], words[0]]
      : words.map((_, index) => words.slice(0, index + 1).join(' '));
    const frames = [];
    for (const phrase of phrases) {
      const result = await fallback([
        () => deline?.brat(phrase),
        () => aqulBrat(phrase),
      ].filter(Boolean));
      const media = Buffer.isBuffer(result) ? result : result?.media;
      if (!Buffer.isBuffer(media)) throw new Error('Maker Brat tidak mengembalikan frame gambar yang valid.');
      frames.push(media);
    }
    return frames;
  };

  const bratVideo = (text) => {
    const value = validateText(text, 'Teks BratVid');
    return fallback([
      () => deline?.bratVideo(value),
      () => zenzxz?.bratVideo(value),
    ].filter(Boolean));
  };

  const iqc = (text) => {
    const value = validateText(text, 'Teks IQC');
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return fallback([
      () => deline?.iqc(value, time),
      () => nexrayIqc(value),
    ].filter(Boolean));
  };

  return Object.freeze({ brat, bratFrames, bratVideo, iqc });
}
