# BUKUR WORLD — Database Backup & Recovery

Disaster-recovery runbook for the production PostgreSQL database.

- **DB engine:** PostgreSQL (16 in local dev; match your Render Postgres major version).
- **Schema source of truth:** `server/schema.sql`, applied idempotently on every
  boot by `server/db/…` (`initDatabase()`). There is **no migration framework** —
  the file is `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE … ADD COLUMN IF NOT
  EXISTS` + idempotent index/constraint DDL. Phase 5D verified that `schema.sql`
  recreates the exact production schema (9 tables / 90 columns / 33 constraints /
  32 indexes / 8 sequences — **zero drift**).
- **Tables:** `admins`, `categories`, `products`, `orders`, `order_items`,
  `payments`, `inventory_adjustments`, `admin_audit_log`, `store_settings`.

---

## 1. Two layers of protection (do not confuse them)

| Layer | What it is | Who runs it | Covers |
|---|---|---|---|
| **Hosting provider backups** | Render Managed PostgreSQL automated backups (and PITR where the plan supports it). Retention and PITR depend on the plan tier — **verify the exact retention in the Render dashboard**; the `starter` plan's retention is short. | Render | Fast recovery of the Render instance itself |
| **Application backup tooling** (this repo) | `npm run db:backup` → `pg_dump` logical dump, copied to storage **outside** the Render container | An operator, a CI job, or a scheduled infrastructure task | Portable, provider-independent copy; protection against accidental `DELETE`/corruption; restore into any Postgres |

The application does **not** and **must not** schedule backups with an
in-process `setInterval` — backups are infrastructure/ops driven.

---

## 2. Create a backup

```bash
# custom format (default) -> backups/bukur-db-<UTC>.dump  (restore with pg_restore)
DATABASE_URL='postgres://USER:PASS@HOST:5432/DBNAME' npm run db:backup

# plain SQL              -> backups/bukur-db-<UTC>.sql
npm run db:backup -- --format plain

# schema only (validate schema independently)
npm run db:backup -- --schema-only
```

`scripts/backup-db.js`:

- reads the connection **only** from `DATABASE_URL` (or `BACKUP_DATABASE_URL`);
  never hardcoded, never from argv.
- passes the password to `pg_dump` via the environment (`PGPASSWORD`), **never on
  the command line**, and never prints it or puts it in a filename.
- honours `DATABASE_SSL` (`true` → `sslmode=require`, `strict` → `verify-full`).
- writes `backups/bukur-db-<UTC>.<ext>` + a `.sha256` sidecar. Timestamped,
  **not** user-controlled. Refuses to overwrite an existing file.
- exits non-zero on any failure and deletes a partial file; reports success only
  after `pg_dump` exits 0 **and** the file is non-empty.
- `PG_DUMP=/path/to/pg_dump` overrides tool discovery.
- `BACKUP_DIR` / `--dir <path>` overrides the output directory.

**After every production backup:** copy the `.dump` and `.sha256` to durable
storage **outside the Render container** (an object-storage bucket, another
host, or an operator's encrypted drive). The Render container filesystem is
ephemeral — a backup left only there is not a backup. This is **separate** from
the Phase 5B media bucket; do not reuse it and do not make it public.

### Retention recommendation (application tooling)

- **Daily** full backup (custom format).
- Keep **7 daily**, **4 weekly**, **3 monthly** copies (adjust to business need
  and storage cost).
- Prune older copies by filename timestamp. Never prune the newest.
- Record the timestamp of the most recent verified-good backup somewhere the
  on-call operator can see it.

---

## 3. Restore into a **clean** database (never over production)

> Do **not** restore over a live database. Restore into a fresh, empty database,
> verify it, then cut over.

```bash
# 1. Provision / identify a CLEAN, empty PostgreSQL database (new Render instance,
#    new local DB, or a container). Note its connection string as $TARGET_URL.

# 2. Stop application writes to the old DB if it is still reachable
#    (scale the Render web service to 0, or put the store in maintenance).

# 3a. custom-format .dump:
pg_restore --no-owner --no-privileges --exit-on-error \
  -d "$TARGET_URL" backups/bukur-db-<UTC>.dump

# 3b. plain .sql:
psql -v ON_ERROR_STOP=1 -d "$TARGET_URL" -f backups/bukur-db-<UTC>.sql

# 4. Verify integrity (see §4).

# 5. Point the API at the restored DB: set DATABASE_URL to $TARGET_URL on Render,
#    redeploy, scale the web service back up.

# 6. Smoke-test critical flows (see §4).
```

`pg_restore` version must be **>=** the major version that produced the dump,
and the target server must be **>=** the source server's major version.

---

## 4. Verify a restore (automated)

```bash
# Restores the backup into a DISPOSABLE database, checks schema + data +
# constraints + indexes + sequences, and confirms server/schema.sql reproduces
# the same schema (drift check). The source DB is read-only throughout; the
# disposable DB(s) are dropped at the end.
DATABASE_URL='postgres://…/DBNAME' \
  npm run db:verify-restore -- backups/bukur-db-<UTC>.dump
```

`scripts/verify-restore.js` guarantees it cannot touch production:

- the disposable target name **must** contain `verify` or `restore_test`, must
  not equal the source DB, and must not be a system database — otherwise it
  aborts before running anything.
- `DROP` only ever targets a name that passed that guard.

It asserts:

| Check | Detail |
|---|---|
| restore ran clean | `pg_restore --exit-on-error` / `psql ON_ERROR_STOP=1` |
| **tables** | set equal to source |
| **columns** | name + type + nullability equal to source |
| **constraints** | every PK / UNIQUE / FK / CHECK present (by name + type) |
| **indexes** | every index present (name + method) |
| **sequences** | present, and `last_value >= max(id)` for the owning table → **future inserts cannot collide** |
| **CHECK actually enforced** | a negative-price `INSERT` is rejected in the restored DB |
| **row counts** | identical to source for a fresh dump→restore |
| **representative data** | products/categories/admins readable and sane (no PII printed) |
| **schema drift** | `server/schema.sql` applied to a fresh DB yields an identical catalog to the restored production schema |

Manual business smoke-test after cutover: open the storefront, load
`/store/products`, place a test order (COD), confirm it appears in `/admin`,
confirm order/payment/inventory rows are consistent, then delete the test order.

---

## 5. Emergency procedure — production DB corrupted or lost

1. **Declare the incident.** Note the time. Assign one operator to drive.
2. **Stop writes.** Scale the Render web service to 0 instances (or enable a
   maintenance page). This prevents further divergence.
3. **Assess.** Is the Render instance recoverable from the provider's own
   backup/PITR? If yes and it is faster, use that path and skip to step 6.
4. **Provision a clean database.** New Render PostgreSQL instance (or restore
   target of your choice), empty.
5. **Restore the newest verified-good backup** (§3) and **verify it** (§4).
6. **Repoint the app.** Set `DATABASE_URL` on the Render API service to the
   restored database. Redeploy.
7. **Smoke-test** critical flows (§4).
8. **Scale the web service back up.** Announce recovery.
9. **Post-incident:** record what was lost (the window between the last backup
   and the incident), the timeline, and any follow-up (backup frequency,
   retention, alerting).

Never `DROP DATABASE` / `TRUNCATE` / restore over the primary as a first move.

---

## 6. RPO / RTO

These follow directly from the configured backup cadence — **do not promise
better than what is actually scheduled.**

- **RPO (max data loss):**
  - With Render provider backups only: **up to ~24 h** (their daily backup), or
    down to minutes **if** the plan includes point-in-time recovery — confirm in
    the dashboard.
  - With the application `db:backup` run **daily**: **up to ~24 h**. Run it more
    often (e.g. every 6 h) to reduce the RPO proportionally.
- **RTO (time to restore):** for a 9-table, single-digit-MB database, a restore
  + verify + repoint is typically **~15–45 minutes** of operator time once a
  clean target database is available. Provisioning a new managed instance adds
  provider lead time. This is an operational estimate, **not a guarantee**.

---

## 7. Production backup checklist

- [ ] Provider (Render) automated backups confirmed **enabled**, retention noted from the dashboard
- [ ] `npm run db:backup` runs successfully against the production `DATABASE_URL` from an ops context
- [ ] A scheduled job (cron / CI / provider task) runs `db:backup` on a defined cadence — **not** an in-app timer
- [ ] Each backup (+ `.sha256`) is copied to durable storage **outside** the Render container
- [ ] Retention policy applied (e.g. 7 daily / 4 weekly / 3 monthly); pruning never removes the newest
- [ ] `npm run db:verify-restore` has been run against a real backup and passed (disposable DB)
- [ ] Restore procedure (§3) rehearsed at least once end-to-end into a clean DB
- [ ] `DATABASE_URL` and DB credentials exist **only** in the host environment — never in Git, logs, or error responses
- [ ] `backups/`, `*.dump`, `*.sql` exports are git-ignored and never served by Express/Vercel/the admin dashboard
- [ ] The on-call operator knows where backups live, how to restore, and who to contact
- [ ] Timestamp of the latest verified-good backup is recorded and visible to on-call
