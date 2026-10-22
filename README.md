# SkyVerse

A modern, modular, and extensible WhatsApp bot built with Node.js and Baileys.

## Status

SkyVerse saat ini difokuskan pada kestabilan WhatsApp core dan command yang benar-benar dapat dipakai.

Fitur utama yang aktif:

- Node.js 20+ dan ES modules
- SQLite persistence untuk data dasar bot
- Dynamic command registry
- WhatsApp Multi-Device melalui Baileys
- QR login, optional pairing code, reconnect, dan invalid-session recovery
- Sticker/media conversion berbasis FFmpeg
- TikTok downloader melalui TikWM
- Instagram downloader melalui ReelsVideo
- YouTube fallback: Deline → Zenzxz → Vreden → Depay
- Facebook fallback: Deline → Zenzxz → Depay
- Pinterest, Twitter/X, MediaFire, dan Google Drive melalui Deline
- Brat: Deline → Zenzxz → aqul-brat fallback
- IQC: Deline → Nexray fallback
- Brat HD lokal 2x
- Maker mock/parody lokal dengan watermark DEMO
- Syntax check dan smoke test

Maker mock yang tersedia: `fakecall`, `fakewagroup`, `fakewachannel`, `fakettprofile`, `fakettcomment`, `fakefbcomment`, dan `mockwallet`. Semua hasil mock diberi tanda DEMO/PARODY dan bukan screenshot atau bukti transaksi asli.

Fitur Economy, Coin, XP, Level, Profile, Achievement, dan Quest telah dihapus agar core bot tetap ringan dan stabil.

## Development

Copy `.env.example` menjadi `.env`, sesuaikan konfigurasi, lalu jalankan:

```bash
npm install
npm run check
npm run smoke
npm run check-media-tools
npm start
```

### Login methods

QR login adalah default.

Untuk pairing code:

```env
USE_PAIRING_CODE=true
PAIRING_NUMBER=628xxxxxxxxxx
```

### Optional provider overrides

```env
DELINE_BASE_URL=https://api.deline.web.id
ZENZXZ_BASE_URL=https://api.zenzxz.my.id
VREDEN_BASE_URL=https://api.vreden.my.id
TIKWM_BASE_URL=https://www.tikwm.com/api/
REELSVIDEO_BASE_URL=https://reelsvideo.io
```

Public third-party APIs dapat berubah atau mengalami outage. SkyVerse memakai fallback chain pada provider penting agar satu provider down tidak langsung mematikan command.
