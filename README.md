# SkyVerse

A modern, modular, and extensible WhatsApp bot built with Node.js and Baileys.

## Status

**Phase 1 — Foundation**

The project currently contains the application foundation:

- Node.js 20+ runtime baseline
- ES modules
- Environment-based configuration
- Structured logger
- Error foundation
- Application lifecycle
- Graceful shutdown handling
- Clean Git ignore rules for runtime and secret data

## Development

Copy `.env.example` to `.env`, adjust the values, then run:

```bash
npm start
```

For development with Node's watch mode:

```bash
npm run dev
```

WhatsApp/Baileys integration is intentionally added in the next phase, after the foundation is verified.
