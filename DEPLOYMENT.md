# Hosting Panel Deployment

## 1. Create the server

Use a Node.js 22 image/egg where possible. Node.js 20 is the minimum supported runtime.

SkyVerse is a long-running WhatsApp client, not an HTTP web app. It does not need a public port.

## 2. Install dependencies

Set the install command to:

```sh
npm install --no-audit --no-fund
```

The repository currently does not include a `package-lock.json`, so do not configure the server to run `npm ci`.

## 3. Configure startup

Set the startup command to:

```sh
npm start
```

No build command is required. The application runs directly from `src/index.js`.

## 4. Configure environment variables

Copy the keys from `.env.example` into the panel's environment-variable section. At minimum, set:

- `OWNER_NUMBER`: owner's WhatsApp number with country code, digits only.
- `AUTH_PATH=./sessions/whatsapp`
- `DATABASE_PATH=./data/skyverse.sqlite`
- `SKYVERSE_PREFIX=.`
- `FEATURE_LIMIT_DEFAULT=10`

For QR login, keep `USE_PAIRING_CODE=false`. The QR code is printed in the server console. Keep the session directory after the first successful link.

Do not put the real `OWNER_NUMBER`, session files, API keys, or database files into GitHub.

## 5. Persistent storage

The following paths must be writable and retained when the container restarts or is reinstalled:

- `sessions/whatsapp` — WhatsApp login credentials and encryption keys.
- `data/` — SQLite database and economy/feature-limit records.

Mount persistent volumes for these paths if the panel supports them. Losing the session directory may require linking WhatsApp again. Losing the database resets stored user/economy state.

## 6. Media runtime

Install system packages in the Node image/container, not from the project's npm dependencies:

- `ffmpeg`
- WebP utilities that include `webpmux`

The FFmpeg build must include `drawtext`, `libwebp`, `libx264`, `libmp3lame`, and `libopus`. Validate from the panel console:

```sh
npm run check-media-tools
```

This check is required for sticker, animated sticker/BratVid, meme, audio conversion, and video conversion commands. A missing executable or codec is a hosting-image issue, not something npm install can repair.

Do not copy Termux FFmpeg binaries or shared libraries into a Linux hosting container. Use binaries built for the panel's operating-system image.

## 7. Verify and start

Run these once after installing dependencies and system media tools:

```sh
npm run check
npm run smoke
npm run smoke-downloader
npm run check-media-tools
```

Then start the bot with `npm start`.

Scan the QR code from WhatsApp → Linked devices. Keep the process running. On subsequent starts, SkyVerse reuses the stored session and reconnects automatically.

## Troubleshooting

- **QR not shown:** check the console output, `AUTH_PATH` permissions, and whether the session is already registered.
- **Repeated relinking:** make sure `sessions/whatsapp` is on persistent storage and the panel does not start two copies against the same session.
- **Database errors:** make sure the directory containing `DATABASE_PATH` exists and is writable.
- **Sticker/video/audio command fails:** run `npm run check-media-tools`; install the missing system binary or codec in the panel image.
- **Downloader fails:** provider APIs, their rate limits, and CDN links are external services. Retry later or inspect which fallback providers failed.
- **Newsletter media post fails:** the pinned Baileys release has a known missing newsletter media-upload transport path. A successful ordinary WhatsApp image send does not prove newsletter media upload works.