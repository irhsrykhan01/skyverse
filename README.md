# SkyVerse

A modern, modular, and extensible WhatsApp bot built with Node.js and Baileys.

## Status

**Stage 3 — User/Profile System + XP & Level**

The current codebase includes the application foundation, WhatsApp core, Economy Core v2, and SkyVerse Profile System:

- Node.js 20+ runtime baseline
- ES modules
- Environment-based configuration
- Structured logger and error foundation
- SQLite-backed persistence
- Dynamic command registry
- WhatsApp Multi-Device connection with multi-file auth
- QR login by default
- Optional pairing-code login with QR fallback
- Automatic reconnect with bounded backoff
- Graceful shutdown handling
- Centralized Coin configuration and formatting
- Atomic Coin credit/debit/transfer ledger
- Periodic claim and daily reward streaks
- Coin transaction history and leaderboard
- Persistent user profile and editable bio
- XP history and activity-based XP rewards
- SkyVerse level progression and titles
- XP leaderboard

## SkyVerse Levels

- Level 1–3: Bintang Kecil
- Level 4–5: Pengawal Langit
- Level 6–10: Penakluk Cakrawala
- Level 11–20: Sultan Langit
- Level 22+: Penguasa Langit

Level 21 is intentionally skipped by the current title map so the requested `22+` tier remains exact; reaching the XP threshold for Level 22 moves directly into `Penguasa Langit`.

## Profile Commands

- `profile` / `profil` / `me` — profile lengkap
- `xp` / `level` / `lvl` — status XP dan level
- `setbio <bio>` / `bio <bio>` — atur bio
- `xplb` — leaderboard XP

Daily, Claim, and successful Coin transfers also grant XP with a global activity cooldown so repeated commands cannot rapidly farm XP.

## Development

Copy `.env.example` to `.env`, adjust the values, then run:

```bash
npm start
```

For development with Node watch mode:

```bash
npm run dev
```

### Login methods

QR login is the default and requires no extra configuration.

To opt into pairing-code login, set:

```env
USE_PAIRING_CODE=true
PAIRING_NUMBER=628xxxxxxxxxx
```

The phone number is normalized to digits by SkyVerse. Keep the country code and do not include a plus sign in the value.

If the pairing-code request cannot be generated or the number is invalid, SkyVerse falls back to printing the QR code instead of stopping startup.

## Verification

Run the syntax check, smoke test, and profile smoke test before deploying:

```bash
npm run check
npm run smoke
node src/diagnostics/profile-smoke.js
```

The smoke test covers command loading, provider wiring, media helpers, economy, games, rich messages, and media-target regressions. The profile smoke test validates the SkyVerse XP curve and title boundaries.
