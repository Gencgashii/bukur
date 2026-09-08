# Schema changes — Phase 1 / Phase 2A

All changes are **additive and non-destructive**. They are appended to
`server/schema.sql`, which runs on every server start. Every statement is
idempotent (`IF NOT EXISTS`), so re-running is safe. No `DROP`, no `ALTER TYPE`,
no data rewrite, no column removal.

## `products`

| Column | Type | Default | Why |
|---|---|---|---|
| `track_inventory` | `boolean` | `false` | Opt-in stock enforcement. Default `false` preserves today's behaviour (nothing is blocked). Existing product "ICON" (stock 0) stays sellable. |
| `sizes` | `jsonb` | `'[]'` | Real size list so the storefront stops fabricating `36–40`. Empty `[]` = "no sizes configured yet" (product sells with no size). |

## `orders`

| Column | Type | Default | Why |
|---|---|---|---|
| `subtotal_cents` | `integer` | `0` | Server-calculated money breakdown, auditable. |
| `shipping_cents` | `integer` | `0` | " |
| `discount_cents` | `integer` | `0` | Always `0` for now — no server promo model. |
| `tax_cents` | `integer` | `0` | `0` unless `TAX_RATE_BPS` is configured. |
| `currency` | `text` | `'eur'` | |
| `country` | `text` | `''` | Structured ISO-2 shipping country (replaces free-text `state` matching). |
| `shipping_method` | `text` | `'standard'` | `standard` / `pickup`. |
| `client_total_cents` | `integer` | `NULL` | The total the browser *claimed* — stored for reconciliation, **never** authoritative. |
| `idempotency_key` | `text` | `NULL` | De-dupes repeated order submissions. Partial-unique index. |
| `updated_at` | `timestamptz` | `NOW()` | |

Index: `orders_idempotency_key_uidx` — unique where `idempotency_key IS NOT NULL`.

## `payments` (new table)

Separate from `orders`. One order → many payment attempts; at most one `paid`.

| Column | Notes |
|---|---|
| `order_id` | FK → `orders(id)` `ON DELETE CASCADE` |
| `provider` | `teb` \| `mock` \| `offline` |
| `method` | `card_teb` \| `bank_transfer` \| `cash_on_delivery` |
| `status` | `unpaid`/`pending`/`paid`/`failed`/`cancelled`/`refunded` (CHECK constrained) |
| `amount_cents` | Always the server order total at initiation time |
| `provider_reference` | Provider transaction id — for reconciliation. No card data. |
| `idempotency_key` | De-dupes payment initiation |
| `error_code` | e.g. `amount_mismatch` |

Indexes:
- `payments_order_id_idx`
- `payments_provider_reference_uidx` — unique `(provider, provider_reference)` where reference set → a provider transaction is processed once.
- `payments_idempotency_key_uidx` — unique where key set.
- `payments_one_paid_per_order_uidx` — unique `(order_id)` where `status = 'paid'` → at most one settled payment per order.

## Rollback

These columns/table are unused by the previous code path, so rolling back the
application does not break the database. To fully revert (only if required):

```sql
DROP TABLE IF EXISTS payments;
ALTER TABLE orders  DROP COLUMN IF EXISTS subtotal_cents, /* ...others... */;
ALTER TABLE products DROP COLUMN IF EXISTS track_inventory, DROP COLUMN IF EXISTS sizes;
```

(Not run automatically. Take a backup first.)

---

# Schema changes — Phase 3 (Admin Dashboard / CMS)

Additive and non-destructive, appended to `server/schema.sql`. One constraint is
**replaced** (`orders_fulfillment_status_chk`) but only to WIDEN the allowed set;
the `DO` block first normalises any legacy `'fulfilled'` value to `'delivered'`
(there are 0 such rows historically). No `DROP TABLE`, no data loss.

## `products` (new columns)

| Column | Type | Default | Why |
|---|---|---|---|
| `sku` | `text` | `NULL` | Stock-keeping unit. Unique (case-insensitive) when set — partial index `products_sku_uidx`. |
| `featured` | `boolean` | `false` | Merchandising flag, read by the storefront. |
| `new_arrival` | `boolean` | `false` | Merchandising flag. |
| `archived` | `boolean` | `false` | Soft-delete. Archived products are hidden from the storefront and the default admin list; historical order rows are untouched. |
| `low_stock_threshold` | `integer` | `3` | Per-product low-stock line for dashboard/inventory alerts. `CHECK (>= 0)`. |
| `images` | `jsonb` | `'[]'` | Ordered `[{url, position}]`. `image_url` is kept in sync with `images[0]` for backward compatibility. |

Indexes added: `products_sku_uidx` (partial unique), `products_category_id_idx`,
`products_status_idx`, `products_archived_idx`.

## `categories`

| Column | Type | Default | Why |
|---|---|---|---|
| `archived` | `boolean` | `false` | Categories are archived, never hard-deleted, so `products.category_id` stays valid. |

## `orders`

- `orders_fulfillment_status_chk` widened: `pending | processing | shipped | delivered | cancelled` (was `pending | fulfilled | cancelled`).
- Indexes added: `orders_created_at_idx` (DESC), `orders_payment_status_idx`, `orders_fulfillment_status_idx`, `orders_customer_email_idx` (`LOWER(customer_email)`).

## `payments`

- Indexes added: `payments_status_idx`, `payments_method_idx`.

## New tables

### `inventory_adjustments`
Append-only history of manual stock changes. `product_id` FK (CASCADE),
`admin_id` FK (`ON DELETE SET NULL`), `quantity_before`, `quantity_after`
(`CHECK >= 0`), `adjustment_quantity` (`CHECK <> 0`), `reason`, `created_at`.
Written in the SAME transaction as the stock update.

### `admin_audit_log`
Append-only record of significant admin actions. `admin_id` FK
(`ON DELETE SET NULL`), `action`, `entity_type`, `entity_id`, `meta` (`jsonb`,
capped ~4 KB, non-sensitive), `created_at`. Inventory adjustments log inside the
transaction; other actions log best-effort (a logging failure never fails the
business operation).

### `store_settings`
`key` (PK) / `value` (`jsonb`) / `updated_at`. Only whitelisted keys
(`bank_transfer`, `contact`, `low_stock_threshold_default`) are writable through
the API. Shipping rates, supported countries and tax remain environment-driven
and are shown read-only.

## Rollback (manual, only if reverting the app)

```sql
DROP TABLE IF EXISTS admin_audit_log, inventory_adjustments, store_settings;
ALTER TABLE products   DROP COLUMN IF EXISTS sku, DROP COLUMN IF EXISTS featured,
  DROP COLUMN IF EXISTS new_arrival, DROP COLUMN IF EXISTS archived,
  DROP COLUMN IF EXISTS low_stock_threshold, DROP COLUMN IF EXISTS images;
ALTER TABLE categories DROP COLUMN IF EXISTS archived;
-- fulfillment constraint: re-add the narrow form if required.
```

---

# Schema changes — Phase 5C (order-confirmation email)

Additive, idempotent, non-destructive. Appended to `server/schema.sql`.

- `orders.confirmation_email_status`   `TEXT NOT NULL DEFAULT 'pending'`
  (`CHECK … IN ('pending','sent','failed','skipped')`, constraint
  `orders_confirmation_email_status_chk`)
- `orders.confirmation_email_sent_at`  `TIMESTAMPTZ` (nullable)
- `orders.confirmation_email_attempts` `INTEGER NOT NULL DEFAULT 0`
- `orders.confirmation_email_error`    `TEXT NOT NULL DEFAULT ''` (short category only)

Operational delivery tracking only — no email body, no recipient copy
(`customer_email` already holds it), no secrets. Existing rows default to
`'pending'`. Phase 5B added **no** schema change.

### Rollback

```sql
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_confirmation_email_status_chk,
  DROP COLUMN IF EXISTS confirmation_email_status,
  DROP COLUMN IF EXISTS confirmation_email_sent_at,
  DROP COLUMN IF EXISTS confirmation_email_attempts,
  DROP COLUMN IF EXISTS confirmation_email_error;
```

---

# Backup, restore & drift verification — Phase 5D

No schema change. Tooling only: `scripts/backup-db.js` (`pg_dump`) and
`scripts/verify-restore.js` (disposable restore + full schema/data/constraint/
index/sequence checks + a drift check that `schema.sql` reproduces the live
schema). See `docs/DATABASE-RECOVERY.md`. Phase 5D verified **zero drift**:
`schema.sql` on a fresh DB == production (9 tables / 90 columns / 33 constraints
/ 32 indexes / 8 sequences).
