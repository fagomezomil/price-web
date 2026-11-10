# price-web

**EN** — Production web viewer for a supermarket price-comparison product: Next.js (App Router, TS strict) + DuckDB/Parquet over R2-synced data, Supabase auth with RLS (favorites, alerts), Meilisearch, and Cloudflare R2 for product images. In active development, running against real daily data.

**ES** — Visor web de producción para un producto de comparación de precios de supermercados: Next.js (App Router, TS strict) + DuckDB/Parquet sincronizados vía R2, Supabase con RLS (favoritos, alertas), Meilisearch, y Cloudflare R2 para imágenes de producto. En desarrollo activo, corriendo con data real diaria.

**Status / Estado:** in progress · en desarrollo.

## What it does / Qué hace

- **Price viewer / visor de precios** — reads the daily Parquet/DuckDB warehouse produced by [price-pipeline](https://github.com/fagomezomil/price-pipeline). In production the VPS pulls a synchronized copy via R2; the web never touches the gestation database directly.
  *Lee el almacén diario Parquet/DuckDB generado por price-pipeline. En producción, el VPS baja una copia sincronizada vía R2; la web nunca abre la base de gestación.*
- **Search / búsqueda** — Meilisearch in production; SQL fallback in dev.
- **Accounts, favorites & price alerts / cuentas, favoritos y alertas** — Supabase auth (magic link) with RLS; alert routes hit user thresholds and send email.
- **Cart & shopping list / carrito y lista** — per-session cart built on the synced price data.
- **Product images / imágenes** — served from Cloudflare R2 by EAN.

## Architecture / Arquitectura

```
price-pipeline (daily) ──► Cloudflare R2 ──► VPS pull & build ──► Next.js (this repo)
                                              │
                       Supabase (auth/RLS, favoritos, alertas) ── Resend mail
                       Meilisearch (search index, from scripts/build-search-index.ts)
```

Key environment contract lives in [`src/env.ts`](src/env.ts) (Zod-validated) — see [`.env.example`](.env.example).

## Repo map / Mapa

| Path | What / Qué |
|---|---|
| `src/app/` | Route handlers & pages: search, product detail (`[ean]`), cart, account, alerts | rutas y páginas |
| `src/app/api/` | API: search, favorites, alerts (+cron trigger), cart, revalidation | endpoints |
| `src/lib/` | DuckDB access, chain metadata, image resolution, formatting | acceso a datos y helpers |
| `scripts/` | VPS pull-and-build + Meilisearch index builder / sincronización VPS e índice de búsqueda |
| `docs/next-build-checklist.md` | Pre-build checklist (memory-leak, standalone, R2 lessons) / checklist de build |

## Run / Cómo correr

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # next build
```

Configure a local `.env.local` from [`.env.example`](.env.example) (never committed / nunca commit).

## License

MIT
