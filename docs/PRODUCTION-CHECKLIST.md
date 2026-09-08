# BUKUR WORLD — Production Configuration Checklist (Phase 5E)

Everything needed to take the store live on **Vercel (storefront + admin) + Render
(API + PostgreSQL)**. The code is production-safe and fails closed on
misconfiguration; the items below are **operational** and must be done in the
provider dashboards / DNS.

Run `npm run production:check -- --strict` after setting the API environment to
get a pass/fail report (it never prints secret values).

---

## 1. Environment variable matrix

`secret` = never in Git, logs, error bodies, or the browser bundle.
`build` = consumed by the React build only (public, baked into the bundle).

### Render — API service (`bukur-api`) — SECRETS (set as "sync: false" / dashboard)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | from the Render `bukur-db` database (`fromDatabase`). Never expose. |
| `JWT_SECRET` | yes | `generateValue: true` in `render.yaml`, or 48+ random bytes hex. ≥ 32 chars enforced at boot. |
| `S3_ACCESS_KEY_ID` | yes (`STORAGE_DRIVER=s3`) | object-storage key, `PutObject`+`DeleteObject` on `products/*` only |
| `S3_SECRET_ACCESS_KEY` | yes (`STORAGE_DRIVER=s3`) | object-storage secret |
| `RESEND_API_KEY` | yes (`EMAIL_ENABLED=true`) | Resend API key |
| `DATABASE_SSL` | conditionally | `true` if the API uses the **external** DB URL or a managed PG that mandates TLS; unset for Render's internal URL |
| `CLIENT_ORIGINS` | yes | comma-separated **https** origins, no trailing slash — the real storefront + admin origins, e.g. `https://bukurworld.com,https://www.bukurworld.com` |
| `EMAIL_FROM` | yes (email on) | `BUKUR WORLD <orders@<verified-domain>>` |
| `EMAIL_REPLY_TO` | no | e.g. `support@<domain>` |
| `S3_PUBLIC_BASE_URL` | yes (`s3`) | public read base, no trailing slash, e.g. `https://img.bukurworld.com` |
| `S3_ENDPOINT` | no | only for non-AWS S3 (R2/MinIO/B2) |
| `S3_FORCE_PATH_STYLE` | no | `true`/`false`; default `true` when `S3_ENDPOINT` set |
| `ALLOW_ADMIN_REGISTER` | no | `true` for the **one-off** first-admin bootstrap, then remove |

### Render — API service — NON-SECRET (safe in `render.yaml`)

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | forces Secure cookies, disables mock payments |
| `STORAGE_DRIVER` | `s3` | `local` is **rejected** for production (ephemeral disk) |
| `S3_BUCKET` / `S3_REGION` | your bucket / region | R2 region = `auto` |
| `EMAIL_ENABLED` | `true` | order confirmations |
| `EMAIL_PROVIDER` | `resend` | `console`/`memory` rejected at boot in production |
| `EMAIL_STORE_URL` | `https://<store-domain>` | optional |
| `ADMIN_COOKIE_SAMESITE` | **`none`** if storefront/admin and API are on **different registrable domains** (typical Vercel + Render); `lax` only if they share a domain. See §3. |
| `SHIPPING_RATES` | `XK:180,AL:480` | cents by ISO-2 |
| `TAX_RATE_BPS` | `0` | set only once VAT is confirmed |
| `ENABLE_COD` | `true` | |
| `PAYMENTS_CARD_PROVIDER` | `teb` | frozen stub until its dedicated phase |
| `PORT` | injected by Render | — |

### Vercel — storefront + admin (build-time, PUBLIC)

| Variable | Required | Notes |
|---|---|---|
| `REACT_APP_API_URL` | **yes** | HTTPS origin of the Render API, e.g. `https://bukur-api.onrender.com`. The build **fails** (`scripts/check-frontend-env.js`) if this is missing or localhost on Vercel/Render. |
| `REACT_APP_BANK_HOLDER` / `_IBAN` / `_NAME` / `_SWIFT` | for bank transfer | public checkout copy |
| `GENERATE_SOURCEMAP` | recommended `false` | smaller bundle, no source exposure |
| `DISABLE_ESLINT_PLUGIN` | `true` | keeps the build green on lint warnings |

Vercel build: framework **Create React App** (auto), build `npm run build`, output
`build/`, SPA rewrite to `/index.html` (see `vercel.json`). Set the vars for the
**Production** environment (and Preview if you use preview deploys).

---

## 2. Domain / HTTPS / CORS / Cookies matrix

Fill the URLs in from the real domains before launch. `*_PENDING` = not yet chosen.

| Component | URL | HTTPS | CORS | Cookies | Status |
|---|---|---|---|---|---|
| Storefront | `https://STORE_DOMAIN_PENDING` (Vercel) | required (Vercel auto) | n/a | n/a | CONFIGURATION REQUIRED — domain + DNS |
| Admin | `https://STORE_DOMAIN_PENDING/admin` (same app) | required | n/a | required (HttpOnly `bukur_admin` + `bukur_csrf`) | CONFIGURATION REQUIRED |
| API | `https://API_DOMAIN_PENDING` (Render) | required (Render auto TLS) | required — `CLIENT_ORIGINS` allowlist, `credentials:true`, no `*` | required — must accept the storefront origin | CONFIGURATION REQUIRED — `CLIENT_ORIGINS` |
| Media | `https://MEDIA_DOMAIN_PENDING` (`S3_PUBLIC_BASE_URL`) | required | n/a | n/a | CONFIGURATION REQUIRED — bucket + public read + custom domain |
| Resend | `https://api.resend.com` | HTTPS (provider) | n/a | n/a | CONFIGURATION REQUIRED — API key + domain SPF/DKIM |
| PostgreSQL | Render private connection string | TLS per `DATABASE_SSL` / URL | n/a | n/a | CONFIGURATION REQUIRED — confirm on first deploy |

---

## 3. Cookies & SameSite — decide from the domain layout

The admin session is an **HttpOnly** cookie (`bukur_admin`) + a JS-readable CSRF
cookie (`bukur_csrf`), both `Secure` in production, `path=/`, host-only (no
`Domain`), 12 h.

- **Storefront/admin and API on the SAME registrable domain**
  (e.g. `bukurworld.com` + `bukurworld.com/api` via a proxy/rewrite):
  `ADMIN_COOKIE_SAMESITE=lax` is fine.
- **Different domains** (e.g. storefront `bukurworld.com` on Vercel, API
  `bukur-api.onrender.com` on Render — the default split):
  set **`ADMIN_COOKIE_SAMESITE=none`**. With `lax`/`strict` the browser will
  not send the cookie on the cross-site `fetch(..., { credentials: 'include' })`
  the admin SPA makes, and **admin login will silently fail**. `none` forces
  `Secure` (already the case in production).

The storefront itself does not use cookies. All admin mutations require the
`X-CSRF-Token` header to equal the `bukur_csrf` cookie (double-submit).

---

## 4. Dashboard / DNS work that this repo cannot do

- **Render**: create the Blueprint from `render.yaml`; set every `sync: false`
  secret; confirm the Node version (`.nvmrc` = 20), the health check
  (`/health`), and the region; confirm **managed-Postgres backup retention /
  PITR** for the chosen plan tier.
- **Object storage** (AWS S3 / Cloudflare R2 / MinIO / B2): create the bucket;
  make objects under `products/` **publicly readable** (bucket policy / R2
  public bucket or custom domain); issue an access key scoped to
  `PutObject`+`DeleteObject` on `products/*` (no `ListBucket`, no admin); set a
  custom media domain and point `S3_PUBLIC_BASE_URL` at it.
- **Resend**: create the account and API key; add the sender domain and verify
  **SPF + DKIM** (and DMARC if desired); set `EMAIL_FROM` to an address on that
  verified domain.
- **DNS**: point the storefront domain at Vercel; point the API subdomain (if
  used) at Render; add the media CNAME; add the email DNS records from Resend.
- **Backups**: schedule `npm run db:backup` from a cron / CI / provider job
  (never an in-app timer) and copy each dump to storage **outside** the Render
  container. See `docs/DATABASE-RECOVERY.md`.

---

## 5. Post-deploy smoke test (manual — run once after the first deploy)

Do **not** create throwaway orders on a live store beyond one deliberate test,
and delete that test order + any test product afterwards.

### Storefront
- [ ] Homepage loads over HTTPS; hero image sharp; no mixed-content warnings
- [ ] Product grid, a category page, a product detail page + gallery + lightbox
- [ ] Responsive layout at mobile width
- [ ] Add to cart → cart page shows item, size, price, totals
- [ ] Checkout page loads; country/shipping estimate shown

### Customer order (one deliberate COD test)
- [ ] Checkout validation rejects a bad email / missing address
- [ ] Place a COD order → success page shows an order number `BK-######`
- [ ] Server total matches (not the client estimate); shipping line correct
- [ ] `email.status` on the response is `sent` (or `skipped` if email deferred)

### Inventory
- [ ] Stock decremented for the ordered product (admin → product)
- [ ] A sold-out / unpublished product cannot be ordered
- [ ] Size selection is enforced

### Admin (`/admin`)
- [ ] Login sets the session; `/admin/dashboard` loads
- [ ] Create a test product, edit it, upload an image → image appears from the
      **media domain** (not the API), gallery order preserved
- [ ] Inventory adjustment records in the audit log
- [ ] Open the test order; change fulfilment status; view payment status
- [ ] Order detail shows `confirmationEmail.status`
- [ ] `Resend confirmation` works and is audited (no address/body in the audit meta)
- [ ] Delete the test order + test product

### Email
- [ ] Confirmation email received in a real inbox
- [ ] Correct order number, line items, sizes, totals, currency
- [ ] Payment wording matches the method (COD → "due on delivery"; bank transfer
      → "please complete the transfer" + bank block + reference)
- [ ] No API key, no internal IDs, no card data anywhere in the email

### Security
- [ ] `GET /admin/dashboard` with no session → 401
- [ ] A normal (non-admin) token → 403
- [ ] Admin mutation without `X-CSRF-Token` → 403
- [ ] `fetch` from a non-allowlisted origin does not get a credentialed response
- [ ] All responses are HTTPS; `bukur_admin` cookie is `HttpOnly; Secure`
- [ ] Rapid repeated login attempts → 429 (rate limited)
- [ ] `/health` returns only `{ ok, service }` — no connection string, no stack

### S3 (safe test — temp object, not a real product image)
- [ ] Upload a generated test image via `/admin/uploads` → 200, URL on the media domain
- [ ] `GET` that URL over HTTPS → 200
- [ ] Remove it (via the admin flow or a scoped delete) → subsequent `GET` → 404
