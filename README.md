# SkyVerse

A modern, modular, and extensible WhatsApp bot built with Node.js and Baileys.

## Status

**Stage 2 — WhatsApp Core + Economy Core v2**

The current codebase includes the application foundation, WhatsApp core, and Economy Core v2:

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

Run the syntax check and smoke test before deploying:

```bash
npm run check
npm run smoke
```

The smoke test covers command loading, provider wiring, media helpers, economy, games, rich messages, and media-target regressions.
