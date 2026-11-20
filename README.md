# Singhania's

Static site (HTML + Tailwind + vanilla JS) with a small Cloudflare Worker API and a D1 database.

| Part | Where |
|---|---|
| Home page, shop, cart drawer, checkout | `index.html`, `fx.js`, `fx.css` |
| Build Your Own Dabba page | `build-your-dabba/` |
| Admin page (token protected) | `admin/` |
| API (catalogue, quote, orders, admin) | `worker/src/` |
| Database schema / seed | `worker/schema.sql`, `worker/seed.mjs`, `data/catalogue.json` |
| Tests | `tests/` |

## How orders work (WhatsApp payment)
1. Customer builds a Dabba and/or adds single packs, then presses **Order via WhatsApp**.
2. The server re-prices everything from the database, checks the rules and stock, saves the order as **pending**, and **reserves** the stock.
3. The customer sends the prefilled WhatsApp message (order number inside) and pays you on WhatsApp.
4. In `/admin/` press **Mark paid** (stock is deducted exactly once) or **Cancel** (stock released). Pending orders release their stock automatically after the hold time (default 12 hours).

Money is stored as integer paise. Prices in the browser are only for display; the server is the source of truth.

## Run locally
```bash
npm install
npm run db:migrate:local      # create tables in the local D1
npm run db:seed:local         # seed catalogue + TEST stock (never use --test-stock in production)
npm run dev                   # http://localhost:8787   (admin token for local dev is in .dev.vars)
npm test                      # API + inventory tests (Miniflare, real D1)
npm run test:ui               # browser tests (needs `npm run dev` running)
npm run build:css             # rebuild styles.css after changing Tailwind classes
```

## Deploying (not done yet, needs your approval)
1. `npx wrangler d1 create singhanias-db` and paste the `database_id` into `wrangler.jsonc`.
2. `npx wrangler d1 execute singhanias-db --remote --file=worker/schema.sql`
3. `node worker/seed.mjs > worker/seed.generated.sql` (NO `--test-stock`), then `npx wrangler d1 execute singhanias-db --remote --file=worker/seed.generated.sql`. Set real stock in `/admin/`.
4. `npx wrangler secret put ADMIN_TOKEN` (a long random string).
5. `npx wrangler deploy`. `.assetsignore` keeps `worker/`, `tests/`, `data/` and config files from being served publicly.
6. If the site is deployed from the Cloudflare dashboard (Git integration), check its build/deploy command so it runs `npx wrangler deploy` and uses `wrangler.jsonc`.

Prices, weights and stock in `data/catalogue.json` are **dummy placeholders**. Production values live in the database and are edited in `/admin/`.
