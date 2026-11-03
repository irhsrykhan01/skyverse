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
- YouTube video dan Shorts melalui yt-dlp lokal (tanpa API key)
- Instagram Reel publik melalui yt-dlp lokal (tanpa API key)
- `.ttmp3`, `.ytmp3`, dan `.igmp3` dikonversi ke MP3 oleh FFmpeg lokal
- Facebook fallback: Deline → Zenzxz
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
npm run check-downloader-tools
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

### Downloader requirements

TikTok memakai API publik TikWM. YouTube (termasuk Shorts) dan Instagram Reel publik memakai executable `yt-dlp` lokal, bukan API berbayar atau API key. Semua command MP3 mengunduh video terlebih dahulu lalu mengonversi audionya memakai FFmpeg lokal.

Di Termux:

```bash
pkg install python ffmpeg -y
python -m pip install -U yt-dlp
```

Di Linux hosting, pasang Python 3, FFmpeg, dan yt-dlp pada environment yang menjalankan bot. Pastikan executable `yt-dlp` tersedia di PATH, atau atur `YTDLP_PATH` di `.env` ke lokasi executable yang benar.

Jalankan `npm run check-downloader-tools` untuk memeriksa yt-dlp dan FFmpeg. Instagram hanya dapat diunduh jika kontennya publik dan masih dapat diakses oleh yt-dlp; konten privat/login-required tidak dijanjikan bisa diunduh.
