const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vt.tiktok.com',
  'vm.tiktok.com',
  'v.tiktok.com',
  't.tiktok.com',
]);

export function normalizeTikTokUrl(input) {
  const raw = String(input ?? '')
    .trim()
    .replace(/^<|>$/g, '')
    .replace(/[),.!?]+$/g, '');

  if (!raw) throw new Error('Masukkan URL video TikTok terlebih dahulu.');

  let parsed;
  try {
    parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw);
  } catch {
    throw new Error('URL TikTok tidak valid.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!TIKTOK_HOSTS.has(hostname)) {
    throw new Error('Gunakan tautan TikTok yang valid (tiktok.com atau vt.tiktok.com).');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Protokol URL TikTok tidak didukung.');
  }
  if (!parsed.pathname || parsed.pathname === '/') {
    throw new Error('Tautan tersebut belum mengarah ke video TikTok.');
  }

  parsed.protocol = 'https:';
  parsed.hash = '';
  return parsed.toString();
}
