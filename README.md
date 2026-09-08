# BUKUR WORLD — Luxury High-Heels E-commerce

A modern storefront for BUKUR WORLD, a luxury women's high-heels house from
Prishtina, Kosovo. Built with React (Create React App) and a lightweight
Express + PostgreSQL backend.

---

## Architecture at a glance

| Layer | Technology | Location | Notes |
|-------|-----------|----------|-------|
| Storefront (UI) | React 18 + React Router 6, Create React App (`react-scripts` 5) | `src/` | Plain CSS, Context API for state, `localStorage` for cart/orders |
| **Active backend** | **Express 5 + PostgreSQL (`pg`)** | **`server/`** | Products, categories, image uploads, admin auth (JWT), order capture |
| Admin dashboard | React (same app) | `src/admin/` | Served at `/admin`, talks to the Express backend |
| Database | PostgreSQL | — | Schema in `server/schema.sql`, applied automatically on server boot |
| `my-medusa-store/` | Medusa 2.x | `my-medusa-store/` | **NOT the active backend.** Kept for reference / possible future use. See note below. |

### Which backend is active?

**`server/` (Express + PostgreSQL) is the backend the storefront uses today.**
`src/config.js`, `src/admin/apiClient.js`, and every React context call the
Express routes (`/store/products`, `/store/custom/orders`, `/admin/*`,
`/auth/user/emailpass`).

`my-medusa-store/` is a separate Medusa installation that is **not wired into
the storefront**. It is retained so its custom order-email logic and product
model can be revisited later, but it is not required to build, run, or deploy
BUKUR WORLD for the current launch. See `my-medusa-store/NOTE.md`.

---

## Prerequisites

- **Node.js 18+** (Node 20 LTS recommended — see `.nvmrc`)
- **npm 9+**
- **PostgreSQL 13+** running locally (or a hosted Postgres URL)

---

## Local development

### 1. Install dependencies

```bash
# storefront + Express backend (share one node_modules at the repo root)
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Then edit `.env`:

- `REACT_APP_API_URL` — leave as `http://localhost:9000` for local dev
- `DATABASE_URL` **or** the discrete `DB_*` fields — point at your local Postgres
- `JWT_SECRET` — any long random string for local dev

> Every `REACT_APP_*` value is compiled into the public JS bundle. Never put a
> password or private key in one.

### 3. Create the database (first time only)

Create an empty database that matches your `.env` (default name: `bukur`):

```bash
createdb bukur
```

The tables in `server/schema.sql` are created automatically the first time the
API starts (`CREATE TABLE IF NOT EXISTS ...`).

### 4. Run the backend

```bash
npm run server
# → BUKUR API running on http://localhost:9000
```

### 5. Create your admin account (first time only)

In a second terminal:

```bash
npm run create-admin
# prompts for email + a 12+ character password
```

### 6. Run the storefront

In a third terminal:

```bash
npm start
# → http://localhost:3000
```

The storefront reads published products from the Express API. If the API is
unreachable it falls back to the sample products in `src/data/products.js`.

---

## Development commands

| Command | What it does |
|---------|--------------|
| `npm start` / `npm run dev` | Start the React dev server on :3000 |
| `npm run build` | Production build into `build/` |
| `npm test` | Create React App test runner (no tests written yet) |
| `npm run server` | Start the Express API on :9000 |
| `npm run create-admin` | Interactively create/update an admin user |

---

## Required environment variables

Full documentation with examples lives in **`.env.example`**. Summary:

### Frontend (`REACT_APP_*`, public, baked into the bundle)

| Variable | Purpose |
|----------|---------|
| `REACT_APP_API_URL` | Base URL of the Express backend (no trailing slash) |
| `REACT_APP_BANK_HOLDER` / `_IBAN` / `_NAME` / `_SWIFT` | Bank-transfer details shown at checkout |
| `GENERATE_SOURCEMAP`, `DISABLE_ESLINT_PLUGIN`, `FAST_REFRESH` | Optional CRA build/dev flags |

### Backend (`server/`, secret, backend host only)

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `9000`; hosts usually inject their own) |
| `DATABASE_URL` | Postgres connection string (preferred) |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Used only when `DATABASE_URL` is empty |
| `JWT_SECRET` | Signs admin JWTs. **Required — the server refuses to start without it** (no insecure fallback). ≥ 32 chars in production. |
| `JWT_EXPIRES_IN` | Admin token lifetime (default `12h`) |
| `CLIENT_ORIGINS` | Comma-separated allowed browser origins for CORS. Dev default `http://localhost:3000`; **required in production** |
| `SHIPPING_RATES` | Shipping cost in cents by ISO-2 country, e.g. `XK:180,AL:480` (server-authoritative) |
| `TAX_RATE_BPS` | Tax in basis points. `0` = none (current behaviour). Do not invent a VAT rate. |
| `CURRENCY` | ISO currency, default `eur` |
| `ENABLE_COD` | Offer cash on delivery? (`true`/`false`) |
| `PAYMENTS_CARD_PROVIDER` | `teb` (real, currently blocked) or `mock` (dev/test only) |
| `PAYMENTS_ALLOW_MOCK` / `PAYMENTS_MOCK_SECRET` | Mock payment provider — dev/test only, force-disabled in production |
| `ALLOW_ADMIN_REGISTER` | Set to `true` only for the one-off first-admin bootstrap |

### Payments (status)

The payment **architecture** is in place (`server/payments/`): an order and a
payment are separate records, payments move through
`unpaid → pending → paid / failed / cancelled / refunded`, amounts always come
from the server-side order total, and provider callbacks are idempotent.

The **real TEB Kosovo gateway is NOT integrated** — `server/payments/providers/teb.js`
is a stub that returns `501`. Online card checkout is disabled until official TEB
merchant API documentation and credentials are available. Bank transfer and cash
on delivery work today and are always created **unpaid** (an admin confirms
payment).

---

## PostgreSQL requirements

- A single database (default name `bukur`).
- No extensions required.
- Schema is plain SQL in `server/schema.sql` and is applied idempotently on
  every server start. There is no migration tool yet — schema changes are made
  by editing that file.
- Tables: `admins`, `categories`, `products`, `orders`, `order_items`.
- Seed data: three categories (`Pumps`, `Slingbacks`, `Statement`) are inserted
  on first boot.

---

## Production architecture

```
                 ┌────────────────────────┐
   Browser  ───▶ │  Static React build    │   (e.g. Vercel / Netlify / any CDN)
                 │  `npm run build` → /build
                 └───────────┬────────────┘
                             │  REACT_APP_API_URL
                             ▼
                 ┌────────────────────────┐
                 │  Express API (server/) │   (e.g. Render / Railway / a VM)
                 │  `npm run server`      │
                 └───────────┬────────────┘
                             │
                             ▼
                 ┌────────────────────────┐
                 │  PostgreSQL database    │   (managed Postgres)
                 └────────────────────────┘
```

- **Frontend:** static hosting of the `build/` folder. Set `REACT_APP_API_URL`
  to the deployed API URL and rebuild. SPA routing/rewrites are configured in
  `vercel.json`.
- **Backend:** a Node web service running `node server/index.js` with
  `DATABASE_URL` and a strong `JWT_SECRET` set. Health check: `GET /health`.
  Reference service/DB definitions are in `render.yaml`.
- **Database:** a managed PostgreSQL instance.

### Known production caveats

- **Admin-uploaded** images: `STORAGE_DRIVER=local` writes them to
  `public/uploads/` on the API's local disk, which is **ephemeral on Render**.
  Production must set `STORAGE_DRIVER=s3` with the `S3_*` variables (see
  **Media & images → Durable storage** below). The API **fails to boot** if
  `s3` is selected with an incomplete configuration — it never silently falls
  back to local.
- Payment online capture is architecture-only (TEB provider is a blocked stub);
  checkout records orders and offers bank transfer / COD.
- **Order-confirmation email** is off by default (`EMAIL_ENABLED=false`).
  Production sets `EMAIL_ENABLED=true`, `EMAIL_PROVIDER=resend`, `EMAIL_FROM`
  (verified domain) and `RESEND_API_KEY`. See **Order confirmation email** below.
- **Database backups** are ops-driven, not in-app. `npm run db:backup`
  (`pg_dump`) + copy off-container; `npm run db:verify-restore` restores into a
  disposable DB and checks schema/data/constraints/indexes/sequences. Full
  runbook: [`docs/DATABASE-RECOVERY.md`](docs/DATABASE-RECOVERY.md).
- **Production configuration**: `npm run production:check -- --strict` validates
  every required variable, URL format, and dangerous combination (fails closed;
  never prints secret values). Full env-var matrix, domain/HTTPS/CORS/cookie
  matrix and the post-deploy smoke test are in
  [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md).

---

## Media & images

The **storefront photography** (hero, campaign, editorial, catalogue fallback)
is a build-time optimised asset pipeline — it does not go through the upload
route or object storage.

- **Source of truth:** the original full-resolution PNGs live in `media-src/`
  (tracked, ~26 MB, never served to browsers). `media-src/legacy/` holds
  obsolete/unreferenced assets kept for provenance (also tracked).
- **Optimise:** `npm run media:optimize` (needs the `sharp` devDependency) reads
  `media-src/*.png` and writes responsive variants to `public/media/`:
  - `NAME.jpg` — 1600px progressive JPEG fallback (mozjpeg q90, 4:4:4)
  - `NAME-{640,960,1280,1600,2000,2560}.avif` (q78, effort 6, 4:4:4) and
    `.webp` (q86, effort 6, smart subsample)
  Each derivative is generated independently from the untouched original, with a
  gentle post-resize sharpen on downscales > 30%. Never enlarges beyond the
  source width. A clean rebuild wipes only generated derivatives, never
  `media-src/`. Quality-first: settings target premium 100–300 KB desktop
  images, not the smallest possible file.
- **Verify:** `npm run media:verify` asserts every derivative exists, has the
  expected width, matches the source aspect ratio, is readable, and is neither
  larger than the source nor suspiciously tiny — and that the sources are intact.
- **Consume:** `src/components/Img.js` renders a `<picture>` with AVIF → WebP →
  JPEG `srcSet`/`sizes` for any `/media/<slug>.(jpg|png)` URL, and passes every
  other URL (admin uploads, external hosts) through as a plain lazy `<img>` so
  nothing 404s. Its `WIDTHS` array must mirror the script's.
- **Database URLs:** `npm run media:reindex` re-points seeded product rows from
  `/media/<slug>.png` to `/media/<slug>.jpg` (idempotent, non-destructive; leaves
  `/uploads/…` and external URLs untouched).

Measured effect: 5 source PNGs 26.3 MB → 65 delivered variants 5.7 MB total.
A browser downloads one variant per image per viewport: product card ≈ 12–24 KB
(AVIF 640w), PDP gallery ≈ 44–120 KB (AVIF 1600w), desktop hero ≈ 57–191 KB
(AVIF 2000w). Visually matched to the source photography — no visible
compression artifacts, banding or softness at normal viewing size.

### Upload validation

`POST /admin/uploads` (authenticated admin + CSRF + write rate-limit) enforces,
in order: multer memory buffer, ≤ 6 files, ≤ 10 MB each, declared-MIME allowlist
(jpeg/png/webp/gif/avif), a **magic-byte content sniff** (`server/lib/imageType.js`)
that must agree with the declared MIME — a renamed script / HTML / SVG / spoofed
`Content-Type` is rejected with `400 file_content_mismatch` — then the storage
layer derives the extension (never user input) and a `crypto.randomUUID()` key.
A partial multi-file upload rolls back objects already written.

### Durable storage (admin uploads)

`server/lib/storage.js` is a small abstraction (`save` / `remove` / `publicUrl` /
`driver`) with two drivers chosen by `STORAGE_DRIVER`:

| | `local` (default) | `s3` (production) |
|---|---|---|
| where | `public/uploads/<uuid>.<ext>`, served by the API | any S3-compatible store (AWS S3, Cloudflare R2, MinIO, B2 …) via `aws4fetch` (SigV4, server-only) |
| key | flat `<uuid>.<ext>` | namespaced `products/<uuid>.<ext>` |
| public URL | `MEDIA_PUBLIC_BASE_URL` + `/uploads/…` or root-relative | `S3_PUBLIC_BASE_URL` + `/products/<uuid>.<ext>` |
| durable on Render | **no** (ephemeral disk) | **yes** |

- **Fail-closed:** `STORAGE_DRIVER=s3` with any required `S3_*` var missing makes
  the API throw at boot (`getStorage()` in `server/index.js`) — it never falls
  back to `local`. Required: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`. Optional: `S3_ENDPOINT`
  (non-AWS), `S3_FORCE_PATH_STYLE`.
- **Provider-neutral:** no provider SDK, no provider-specific public-URL
  guessing — the public URL always comes from `S3_PUBLIC_BASE_URL`.
- **Least privilege:** the app only needs `s3:PutObject` + `s3:DeleteObject` on
  `<bucket>/products/*`. No bucket listing, no admin rights.
- **Safe delete:** `remove(key)` refuses any key outside the `products/`
  namespace (and rejects `..`, `//`, whitespace) — an arbitrary key from a
  client can never delete an arbitrary object.
- **Static storefront media is unaffected** — `/media/*` files ship with the
  build and never touch this layer. This phase only makes *future admin uploads*
  durable; no existing product data or URL is migrated.
- Credentials are read from the environment on the server only and never appear
  in the client bundle, logs, error bodies, or generated URLs.

---

## Order confirmation email

A transactional confirmation email is sent **server-side** when an order is
created. `server/lib/email/` is a small abstraction:

```
order flow  ->  sendOrderConfirmationForOrder(orderId)   (server/lib/email/sendOrderConfirmation.js)
            ->  getEmailService().send({to,subject,html,text})   (server/lib/email/index.js)
            ->  provider: console | memory | resend      (server/lib/email/providers/*)
```

- **Template** (`render.js`) is a pure function of persisted data only — the
  `orders` row, `order_items`, the latest `payments` row, and the store's
  `contact` / `bank_transfer` settings. It renders table-based, inline-CSS HTML
  plus a `text/plain` fallback. Luxury ivory / bronze / serif styling with one
  mobile media query. **No product images** this phase (avoids broken/relative
  URLs — see the S3 note above). Every interpolated value is HTML-escaped.
- **Payment honesty:** the email never says a payment was received unless the
  persisted `payments.status` / `orders.payment_status` is `paid`. COD →
  "payment due on delivery"; bank transfer (unpaid) → "please complete the
  transfer" + the bank block + the order number as reference; card (unpaid) →
  "awaiting payment". Payment success is never inferred from the browser.
- **Order safety:** the email is attempted *after* the order transaction has
  committed and can never roll it back. The `POST /store/custom/orders`
  response always reports the order; `email: { status }` is
  `sent | failed | skipped | pending` (and `emailSent` is a boolean alias).
- **Idempotency:** an atomic `UPDATE … WHERE confirmation_email_status IN
  ('pending','failed') AND attempts < cap` claims each send, so an idempotent
  replay, refresh, or restart never sends a duplicate. An already-`sent` order
  is not re-sent unless an admin forces it.
- **Retry:** bounded — ≤ 3 attempts per call on transient failures
  (`provider_5xx` / `timeout` / `network`), ≤ 8 attempts total per order.
  A failed order is retryable from the admin order view
  (`POST /admin/orders/:id/resend-confirmation`, admin + CSRF + rate-limit +
  audit; recipient is always the order's stored email, never a parameter).
- **Delivery state** lives in additive `orders` columns
  (`confirmation_email_status/_sent_at/_attempts/_error`) — no email body, no
  recipient copy, no secrets; `error` is a short category only.
- **Config:** `EMAIL_ENABLED` (default `false`), `EMAIL_PROVIDER`
  (`console` dev / `memory` tests / `resend` prod), `EMAIL_FROM` (required when
  enabled), `EMAIL_REPLY_TO`, `EMAIL_STORE_URL`, and the server-only secret
  `RESEND_API_KEY`. Fail-closed: enabling email without `EMAIL_FROM`, or using
  `console`/`memory` in production, or `resend` without `RESEND_API_KEY`, makes
  the API refuse to boot. `console` writes previews to `.mail-preview/`
  (git-ignored) and never sends.

---

## Deployment overview

1. **Provision PostgreSQL** and note its connection string.
2. **Deploy the Express API** (`server/`) as a Node service:
   - Build: `npm install`
   - Start: `npm run server`
   - Env: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`
   - Health check path: `/health`
3. **Create the first admin** by temporarily setting `ALLOW_ADMIN_REGISTER=true`
   and calling `POST /auth/admin/register`, or by running `npm run create-admin`
   against the production database. Remove the flag afterwards.
4. **Deploy the storefront**:
   - Set `REACT_APP_API_URL` to the API URL (and the `REACT_APP_BANK_*` values).
   - Build: `npm run build`
   - Publish: the `build/` directory.
5. **Restrict CORS** on the API to the storefront domain(s).
6. **Set up database backups** — see
   [`docs/DATABASE-RECOVERY.md`](docs/DATABASE-RECOVERY.md): confirm the Render
   managed-Postgres backup retention, schedule `npm run db:backup` from an ops
   job, copy each dump off-container, and rehearse `npm run db:verify-restore`.

A step-by-step guide (in Albanian) is in `DEPLOY.md`.

---

## Database backup & recovery

Ops-driven, never in-process. Summary (full runbook:
[`docs/DATABASE-RECOVERY.md`](docs/DATABASE-RECOVERY.md)):

| command | what it does |
|---|---|
| `npm run db:backup` | `pg_dump` → `backups/bukur-db-<UTC>.dump` (+ `.sha256`). Custom format by default; `-- --format plain` / `-- --schema-only` also supported. Connection + password come only from `DATABASE_URL`/env, never argv or logs. Refuses to overwrite; exits non-zero on failure. |
| `npm run db:verify-restore -- <file>` | Restores the backup into a **disposable** database (name must contain `verify`/`restore_test`; source DB is read-only), then checks tables, columns, constraints, indexes, sequences (`last_value >= max(id)`), row counts, an enforced CHECK, and that `server/schema.sql` reproduces the same schema (drift check). Drops the disposable DB(s) after. |

- **`schema.sql` is the schema source of truth** and is applied idempotently on
  every boot. Phase 5D verified it recreates the exact production schema — **no
  drift** (9 tables / 90 columns / 33 constraints / 32 indexes / 8 sequences).
- Backups contain customer + business data. `backups/`, `*.dump`, `*.sql`
  exports are git-ignored and must never be served by Express/Vercel/admin or
  copied into `public/`.
- Two layers: **Render managed-Postgres backups** (retention per plan — verify
  in the dashboard) + **this repo's logical dumps** copied to storage **outside
  the container**. RPO ≈ your backup interval (~24 h for daily); RTO ≈ 15–45 min
  operator time for this DB size once a clean target exists.

---

## Project structure

```
src/
├── components/     Header, Footer, ProductCard, WelcomeScreen, GenderCategories, ...
├── pages/          Home, Products, ProductDetail, Cart, Checkout
├── context/        LanguageContext, ProductsContext, CartContext, OrdersContext
├── admin/          AdminPage + apiClient (product dashboard at /admin)
├── data/           products.js (sample/fallback catalogue)
├── config.js       API_URL + BANK_DETAILS from env
├── translations.js EN / SQ dictionary
├── index.css       design tokens + reset
└── luxury.css      editorial style layer (loaded last)

server/
├── index.js        Express app: auth, products, categories, uploads, orders
├── db.js           pg Pool + schema bootstrap
├── schema.sql      table definitions + category seed
└── create-admin.js interactive admin creation

scripts/
├── optimize-media.js        media-src/*.png -> public/media/*.{jpg,avif,webp}
└── reindex-product-media.js  re-point product image URLs .png -> .jpg (idempotent)

media-src/          original photography (tracked source; not served)
└── legacy/         obsolete assets, local safety copy (git-ignored)

my-medusa-store/    Medusa install — NOT the active backend (see NOTE.md)
```

---

## License

© 2026 BUKUR WORLD. All rights reserved.
