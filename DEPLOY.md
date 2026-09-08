> ## ⚠️ ARKITEKTURA AKTIVE / ACTIVE ARCHITECTURE
>
> Për publikimin e shtatorit 2026, backend-i aktiv është **Express + PostgreSQL
> (`server/`)** — jo Medusa.
>
> - Frontend: React (Create React App), build statik i `build/`
> - Backend: `server/` (Express), `npm run server`, health check `GET /health`
> - Database: PostgreSQL (`server/schema.sql`)
> - Konfigurimi i deployment-it: shih `render.yaml` dhe `README.md`
>
> `my-medusa-store/` **NUK** është backend-i aktiv. Hapat më poshtë që përmendin
> Medusa mbahen vetëm si referencë për një fazë të mëvonshme dhe nuk kërkohen
> për këtë publikim. Shih `my-medusa-store/NOTE.md`.
>
> For the September 2026 launch the active backend is **Express + PostgreSQL
> (`server/`)**, not Medusa. The Medusa-specific steps below are kept for
> reference only. The authoritative guide is `README.md`.

---

## Media storage (admin uploads) — REQUIRED in production

Admin-uploaded product images must go to durable object storage. Render's disk
is ephemeral, so `STORAGE_DRIVER=local` loses every upload on redeploy.

On the Render API service set:

| Variable | Required | Notes |
|---|---|---|
| `STORAGE_DRIVER` | yes | `s3` |
| `S3_BUCKET` | yes | bucket name |
| `S3_REGION` | yes | AWS region, or `auto` for Cloudflare R2 |
| `S3_ACCESS_KEY_ID` | yes | **secret** |
| `S3_SECRET_ACCESS_KEY` | yes | **secret** |
| `S3_PUBLIC_BASE_URL` | yes | public read base, no trailing slash — final URL is `<base>/products/<uuid>.<ext>` |
| `S3_ENDPOINT` | no | only for non-AWS S3 providers (e.g. `https://<acct>.r2.cloudflarestorage.com`) |
| `S3_FORCE_PATH_STYLE` | no | `true`/`false`; defaults to `true` when `S3_ENDPOINT` is set |

Bucket permissions for the API key: **`s3:PutObject` + `s3:DeleteObject` on
`<bucket>/products/*` only** — no list, no admin. Make objects under
`products/` publicly readable (bucket policy / R2 public bucket or custom
domain) so the storefront can load them.

If `STORAGE_DRIVER=s3` is set but any required `S3_*` var is missing, the API
**refuses to boot** (fail-closed) — it never falls back to local disk.

Static storefront photography (`public/media/*`) ships with the build and is
unaffected by this.

---

## Order confirmation email — production configuration

Sent server-side after each order. Off by default. On the Render API service:

| Variable | Required | Notes |
|---|---|---|
| `EMAIL_ENABLED` | yes | `true` |
| `EMAIL_PROVIDER` | yes | `resend` (in production `console`/`memory` are rejected at boot) |
| `EMAIL_FROM` | yes | `BUKUR WORLD <orders@your-verified-domain.com>` — the domain must be verified (SPF/DKIM) in the Resend dashboard |
| `RESEND_API_KEY` | yes | **secret** |
| `EMAIL_REPLY_TO` | no | e.g. `support@your-domain.com` |
| `EMAIL_STORE_URL` | no | absolute `https://…` base for links in the email |

If `EMAIL_ENABLED=true` and `EMAIL_FROM` or `RESEND_API_KEY` is missing, the API
**refuses to boot** (fail-closed). A mail failure never rolls back an order —
the customer still gets their confirmation page; failed emails are retryable
from the admin order view. No email credential is ever exposed to the browser.

Local development: leave `EMAIL_ENABLED=false`, or set `EMAIL_PROVIDER=console`
to write previews to `.mail-preview/` without sending.

---

## Production configuration

Full env-var matrix + domain/HTTPS/CORS/cookie matrix + post-deploy smoke test:
**`docs/PRODUCTION-CHECKLIST.md`**.

Before deploying, set the API environment on Render and run:

```bash
npm run production:check -- --strict
```

It reports every variable (name / scope / secret / status), validates URL
formats, and **fails closed** on dangerous combinations (weak/short `JWT_SECRET`,
missing `CLIENT_ORIGINS`, wildcard CORS, `STORAGE_DRIVER=local` in production,
`s3` without credentials, email enabled without `RESEND_API_KEY`, `console` email
in production, non-https `REACT_APP_API_URL`, …). It never prints secret values.

Key decisions that are NOT in the repo and must be made in the dashboards:

- **`ADMIN_COOKIE_SAMESITE`** — must be `none` if the storefront/admin and the
  API are on different registrable domains (the default Vercel + Render split),
  otherwise admin login silently fails. See `docs/PRODUCTION-CHECKLIST.md` §3.
- **Object storage** — bucket + public read for `products/*` + a scoped
  `PutObject`/`DeleteObject` key + `S3_PUBLIC_BASE_URL` (`docs` §4).
- **Resend** — API key + a verified sender domain (SPF/DKIM).
- **DNS/HTTPS** for the storefront, API and media domains.

---

## Database backup & recovery

Full runbook: **`docs/DATABASE-RECOVERY.md`**. In short:

- Render Managed PostgreSQL takes automated backups — **check the retention
  window for your plan tier in the Render dashboard** and confirm it is enabled.
- In addition, run the repo's provider-independent logical backup on a schedule
  from an ops context (cron / CI / provider scheduled job — **never** an in-app
  timer):

  ```bash
  DATABASE_URL='postgres://…' npm run db:backup            # -> backups/bukur-db-<UTC>.dump (+ .sha256)
  ```

  Copy each dump **outside** the Render container (separate from the Phase 5B
  media bucket; never public). Suggested retention: 7 daily / 4 weekly / 3
  monthly.
- Never restore over production. Restore into a clean database, verify, repoint:

  ```bash
  npm run db:verify-restore -- backups/bukur-db-<UTC>.dump   # disposable DB, full integrity check
  pg_restore --no-owner --no-privileges --exit-on-error -d "$CLEAN_TARGET_URL" backups/bukur-db-<UTC>.dump
  ```

- `backups/`, `*.dump`, `*.sql` exports are git-ignored and must not be served
  by Express, Vercel, or the admin dashboard.

---

# BUKUR WORLD — Faza 1: Publikimi i Website-it

Ky udhëzues të çon nga projekti lokal te një website **live** me:
- ✅ Transfer bankar
- ✅ Pagesë në dorëzim
- ✅ Porosi reale + email konfirmimi

> **Shënim:** seksionet për Medusa/Render/Resend më poshtë i referohen një
> setup-i alternativ me Medusa. Për setup-in aktual (React + Express +
> PostgreSQL) ndiq `README.md` → "Deployment overview".

---

## Para se të fillosh

Mblidh këto nga klienti:

| Çfarë | Shembull |
|-------|----------|
| Domain | `bukurworld.com` |
| IBAN bankar | Llogaria e biznesit |
| Emri i bankës | Raiffeisen, NLB, etj. |
| Email për porosi | `orders@bukurworld.com` |
| Llogari Resend | [resend.com](https://resend.com) (falas për fillim) |

---

## Hapi 1 — Backend (Medusa) në Render

1. Krijo llogari në [render.com](https://render.com)
2. Lidhe GitHub repo-n (ose upload projektin)
3. Kliko **New → Blueprint** dhe zgjidh `render.yaml` nga repo
4. Ose manualisht:
   - **Web Service** → root: `my-medusa-store`
   - Build: `npm install && npm run build`
   - Start: `npm run start`
   - Shto **PostgreSQL** database

5. Vendos variablat e mjedisit (Settings → Environment):

```
STORE_CORS=https://bukurworld.com,https://www.bukurworld.com
ADMIN_CORS=https://bukur-api.onrender.com
AUTH_CORS=https://bukur-api.onrender.com
MEDUSA_DEFAULT_REGION_ID=reg_01KJGNNB7F58NMWSGDHYTHGR0Q
RESEND_API_KEY=re_xxxxx
RESEND_FROM=BUKUR WORLD <orders@bukurworld.com>
BANK_HOLDER=BUKUR WORLD
BANK_IBAN=XX00 0000 0000 0000 0000
BANK_NAME=Raiffeisen Bank Kosovo
```

6. Pas deploy-it, URL-ja e backend-it do jetë diçka si:
   `https://bukur-medusa.onrender.com`

7. Hap Medusa Admin: `https://bukur-medusa.onrender.com/app`
   - Krijo admin user nëse është hera e parë
   - Verifiko produktet dhe çmimet

---

## Hapi 2 — Frontend në Vercel

1. Krijo llogari në [vercel.com](https://vercel.com)
2. **Import Project** nga GitHub
3. Root directory: projekti kryesor (jo `my-medusa-store`)
4. Framework: **Create React App** (auto-detect)

5. Vendos Environment Variables:

```
REACT_APP_MEDUSA_URL=https://bukur-medusa.onrender.com
REACT_APP_MEDUSA_PUBLISHABLE_KEY=pk_9f814f01f0d29d23cadc137e19b89a0a1f97eceae91382099074319f94df3549
REACT_APP_MEDUSA_REGION_ID=reg_01KJGNNB7F58NMWSGDHYTHGR0Q
REACT_APP_BANK_HOLDER=BUKUR WORLD
REACT_APP_BANK_IBAN=XX00 0000 0000 0000 0000
REACT_APP_BANK_NAME=Raiffeisen Bank Kosovo
REACT_APP_BANK_SWIFT=RBKOXKPR
```

6. Deploy → merr URL si `https://bukur-world.vercel.app`

7. **Përditëso STORE_CORS** në Render me URL-n e Vercel-it (ose domain-in final)

---

## Hapi 3 — Domain (opsional por rekomandohet)

1. Bli domain nga Namecheap, GoDaddy, ose Cloudflare
2. Në Vercel: Settings → Domains → shto `bukurworld.com`
3. Në DNS provider, shto rekordet që tregon Vercel
4. Përditëso `STORE_CORS` në backend me domain-in e ri

---

## Hapi 4 — Testo para se t'ia japësh klientit

- [ ] Faqja hapet në telefon dhe desktop
- [ ] Produktet shfaqen nga Medusa (jo vetëm statike)
- [ ] Shton produkt në shportë
- [ ] Checkout me **Transfer Bankar** → shfaq IBAN
- [ ] Checkout me **Para në Dorëzim** → porosia regjistrohet
- [ ] Email konfirmimi arrin te klienti
- [ ] Porosia shfaqet në Medusa Admin

---

## Si funksionon pagesa (Faza 1)

### Transfer Bankar
1. Klienti zgjedh "Transfer Bankar"
2. Shfaqen të dhënat e bankës (IBAN)
3. Pas porosisë, merr numrin e referencës `#xxxxx`
4. Transferon shumën në bankë me atë referencë
5. **Ju** konfirmoni pagesën manualisht dhe dërgoni porosinë

### Para në Dorëzim
1. Klienti paguan kur merr paketën
2. Porosia regjistrohet direkt

---

## Zhvillim lokal

```bash
# Terminal 1 — Backend
cd my-medusa-store
npm run dev

# Terminal 2 — Frontend
cd ..
cp .env.example .env.local
# Plotëso .env.local me vlerat lokale
npm start
```

---

## Kosto e vlerësuar

| Shërbimi | Kosto |
|----------|-------|
| Vercel (frontend) | Falas |
| Render (backend + DB) | ~$14–25/muaj |
| Domain | ~€10/vit |
| Resend email | Falas deri 3,000/muaj |

---

## Faza 2 (më vonë)

- Stripe për pagesë me kartelë online
- Panel admin i thjeshtuar për klientin

---

## Ndihmë e shpejtë

**Produktet nuk shfaqen?**
→ Kontrollo `REACT_APP_MEDUSA_URL` dhe që backend-i është online

**Porosia nuk regjistrohet?**
→ Kontrollo `STORE_CORS` përfshin URL-n e frontend-it

**Email nuk vjen?**
→ Kontrollo `RESEND_API_KEY` dhe verifiko domain-in në Resend

**IBAN i gabuar në checkout?**
→ Përditëso `REACT_APP_BANK_IBAN` në Vercel dhe redeploy
