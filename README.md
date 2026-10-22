# SkyVerse

A modern, modular, and extensible WhatsApp bot built with Node.js and Baileys.

## Status

SkyVerse saat ini difokuskan pada kestabilan WhatsApp core dan command yang benar-benar dapat dipakai.

Fitur utama yang aktif:

- Node.js 20+ dan ES modules
- Environment-based configuration
- SQLite persistence untuk data dasar bot
- Dynamic command registry
- WhatsApp Multi-Device melalui Baileys
- QR login dan optional pairing-code login
- Automatic reconnect dan invalid-session recovery
- Graceful shutdown
- Sticker dan media conversion berbasis FFmpeg
- Downloader TikTok, Facebook, Instagram, dan YouTube melalui provider
- Group utilities, games, dan command umum
- Syntax check dan smoke test

Fitur Economy, Coin, XP, Level, Profile, Achievement, dan Quest telah dihapus dari build ini agar core bot tetap ringan dan stabil.

## Development

Copy `.env.example` menjadi `.env`, sesuaikan konfigurasi, lalu jalankan:

```bash
npm start
```

Mode development:

```bash
npm run dev
```

### Login methods

QR login adalah default dan tidak memerlukan konfigurasi tambahan.

Untuk pairing code:

```env
USE_PAIRING_CODE=true
PAIRING_NUMBER=628xxxxxxxxxx
```

Nomor akan dinormalisasi menjadi digit. Gunakan kode negara dan jangan memakai tanda plus.

Jika pairing code gagal dibuat atau nomor tidak valid, SkyVerse akan kembali menampilkan QR.

## Verification

Sebelum menjalankan bot, cek source dan smoke test:

```bash
npm run check
npm run smoke
npm run check-media-tools
```

`check-media-tools` memastikan `ffmpeg` dan `webpmux` tersedia untuk command media.
