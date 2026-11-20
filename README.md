# SkyVerse

SkyVerse is a modular WhatsApp bot built with Node.js, ES modules, Baileys, SQLite, and FFmpeg.

## Runtime

- Node.js 20 or newer (Node.js 22 LTS is recommended).
- npm.
- FFmpeg with `drawtext`, `libwebp`, `libx264`, `libmp3lame`, and `libopus` support.
- WebP utilities providing `cwebp`, `webpmux`, and `dwebp`.
- DejaVu Sans Bold font (`fonts-dejavu-core`) for Smeme.
- Persistent, writable storage for WhatsApp sessions and the SQLite database.

The bot does not expose an HTTP website or require a public application port. It connects outward to WhatsApp.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `OWNER_NUMBER` to the owner's WhatsApp number using digits only, including the country code.
3. Review the session, database, and provider settings.
4. Install dependencies and verify the runtime:

```sh
npm install --no-audit --no-fund
npm run check
npm run smoke
npm run smoke-downloader
npm run check-media-tools
```

Start the bot with `npm start`. For development with Node watch mode, use `npm run dev`.

## WhatsApp login

QR login is enabled by default. Keep the process running, scan the QR code in WhatsApp under **Linked devices**, and retain the session directory between restarts.

Optional pairing-code login:

```env
USE_PAIRING_CODE=true
PAIRING_NUMBER=628xxxxxxxxxx
```

Use the international number without a plus sign. If pairing cannot be requested, SkyVerse falls back to QR login.

## Economy and feature quotas

- `.coin` shows the user's Coin balance. `.balance` remains an alias.
- `.limit` shows the remaining daily quota for each limited feature.
- `FEATURE_LIMIT_DEFAULT` controls the default quota per command (default: 10 uses per day).
- Daily quotas reset at 00:00 WIB and are persisted in SQLite.
- The configured owner bypasses Coin costs and feature quotas. The owner number belongs in private environment configuration, not source code.

The default per-feature quota applies to commands in the Downloader, Sticker, Media, Sticker-Media, and Tools categories. A command can override this with its own `dailyLimit` setting.

## Hosting panel deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Node.js panel settings, startup instructions, persistent storage, and media-runtime requirements.

## Configuration

Important environment variables: `OWNER_NUMBER`, `SKYVERSE_PREFIX`, `AUTH_PATH`, `DATABASE_PATH`, `AUTO_READ`, `AUTO_ONLINE`, `USE_PAIRING_CODE`, `PAIRING_NUMBER`, `FEATURE_LIMIT_DEFAULT`, `KEYRA_API_KEY`, `DEPAY_BASE_URL`, `KEYRA_BASE_URL`, `BRAT_BASE_URL`, `NEXRAY_BASE_URL`, and `REMOVE_BG_BASE_URL`.

Provider availability, API limits, and CDN links are external and can change independently of SkyVerse. Downloader commands use provider fallback and validate downloaded media before sending it.

## Verification

GitHub Actions runs the syntax check, command/integration smoke tests, downloader fallback tests, and media-tool capability checks. The Baileys newsletter media compatibility check remains a diagnostic because the pinned Baileys release does not provide the internal newsletter media-upload path required by that feature.