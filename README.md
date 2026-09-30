# SkyVerse

A modern, modular, and extensible WhatsApp bot built with Node.js and Baileys.

## Status

**Stage 4 — Achievement + Quest System**

The current codebase includes the application foundation, WhatsApp core, Economy Core v2, SkyVerse Profile System, and the new Achievement + Daily Quest layer:

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
- Persistent achievement unlocks
- Daily quest progress and claimable rewards

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
- `achievement` / `ach` — daftar achievement
- `quest` / `misi` — daily quest
- `quest claim <id>` — ambil reward quest yang sudah selesai

## Achievements

Current achievements include first activity, first Daily, first Coin transfer, 1.000 Coin reward accumulation, and level milestones at 5, 10, 20, and 22.

## Daily Quests

Three rotating-by-day quest definitions are currently available:

- `daily_claim` — ambil Daily 1 kali
- `daily_xp` — dapatkan 30 XP dari aktivitas
- `daily_transfer` — kirim Coin 1 kali

Quest progress is stored per user and day. Completed quests must be explicitly claimed and grant their configured Coin + XP rewards.

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

Run all checks before deploying:

```bash
npm run check
npm run smoke
npm run smoke:profile
npm run smoke:progression
```

The progression smoke test validates achievement unlocks, daily quest progress, and quest reward claiming.
