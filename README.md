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

## Dabba pricing and tiers
- Dabba packs are listed at the shop price for the same weight. A **tier discount** is then applied per Dabba by the server: 10% from 3 packs, 15% at 6 packs (3–5 packs get 10%).
- Tiers are edited in `/admin/` under "Dabba discount tiers" (format `3:10, 6:15`; leave empty for no discount). They are stored in the database setting `dabba_tiers`.
- The discount is rounded to whole paise, stored with each order (`gross_paise`, `discount_percent`, `discount_paise`), and shown in the cart and the WhatsApp message.
- "You save" compares the Dabba price with the same weight at shop prices (pro-rata of the smallest shop pack that holds at least that much).

## Run locally
```bash
npm install
npm run dev                   # http://localhost:8787 (creates a local database automatically; admin token for dev is in .dev.vars)
npm test                      # API + inventory tests (Miniflare, real D1)
npm run test:ui               # browser tests (needs `npm run dev` running)
npm run build:css             # rebuild styles.css after changing Tailwind classes
```

## Deploying
Pushing to `main` deploys through the Cloudflare Git integration.
- **Database:** `wrangler.jsonc` has no `database_id`, so Cloudflare creates `singhanias-db` on the first deploy. The Worker creates its tables and loads the starting catalogue on the first API request (`worker/src/bootstrap.js`, `worker/src/catalogue.js`).
- **Starting stock is a placeholder** (25 per pack, Regular Chakli 15, Regular Chiwda 20). Set real stock in `/admin/`.
- **Admin password:** in the Cloudflare dashboard open Workers & Pages, then `singhanias`, then Settings, then Variables and Secrets, and add a **secret** named `ADMIN_TOKEN` (a long random string). Until it is set, `/admin/` is disabled. Or: `npx wrangler secret put ADMIN_TOKEN`.
- `.assetsignore` keeps `worker/`, `tests/` and config files from being served publicly.

Prices, weights and starting stock in `worker/src/catalogue.js` are **dummy placeholders**. After the first start, the database (edited in `/admin/`) is the source of truth.
