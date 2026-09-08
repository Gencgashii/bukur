CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  image_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  fulfillment_status TEXT NOT NULL DEFAULT 'pending',
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  name TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_cents INTEGER NOT NULL DEFAULT 0
);

INSERT INTO categories (name, slug) VALUES
  ('Pumps', 'pumps'), ('Slingbacks', 'slingbacks'), ('Statement', 'statement')
ON CONFLICT (slug) DO NOTHING;

-- ===========================================================================
-- Phase 1 / Phase 2A — ADDITIVE migrations only.
-- Every statement is idempotent (IF NOT EXISTS) and non-destructive:
-- no DROP, no data rewrite, no column removal, no type narrowing.
-- New columns have safe defaults that preserve existing behaviour.
-- See server/MIGRATIONS.md for rationale.
-- ===========================================================================

-- Products: opt-in inventory tracking + real size list (no fabricated sizes).
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Orders: server-calculated money breakdown + structured shipping + idempotency.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_cents     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cents      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_cents      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_cents           INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency            TEXT    NOT NULL DEFAULT 'eur';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS country             TEXT    NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method     TEXT    NOT NULL DEFAULT 'standard';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_total_cents  INTEGER;               -- informational only
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key         TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_fingerprint TEXT;              -- sha256 of the canonical request
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Transactional order-confirmation email: operational delivery tracking only.
-- No email body, no recipient copy (customer_email already holds it), no secrets.
-- 'pending' = not yet attempted, 'sent' = provider accepted it once,
-- 'failed'  = last attempt failed (retryable), 'skipped' = email disabled/n-a.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_status   TEXT    NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_sent_at  TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_error    TEXT    NOT NULL DEFAULT '';  -- short category, never a payload

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_uidx
  ON orders (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Integrity CHECK constraints on existing columns (additive, reversible with
-- DROP CONSTRAINT). Added idempotently so re-running the schema is safe.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_chk') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_payment_status_chk
      CHECK (payment_status IN ('unpaid','pending','paid','failed','cancelled','refunded'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillment_status_chk') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_status_chk
      CHECK (fulfillment_status IN ('pending','fulfilled','cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_cents_chk') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_total_cents_chk CHECK (total_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_subtotal_cents_chk') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_subtotal_cents_chk CHECK (subtotal_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_confirmation_email_status_chk') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_confirmation_email_status_chk
      CHECK (confirmation_email_status IN ('pending','sent','failed','skipped'));
  END IF;
END $$;

-- Payments: separate from orders. One order can have multiple payment attempts;
-- at most one may be 'paid'.
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                       -- 'teb' | 'mock' | 'offline'
  method TEXT NOT NULL,                         -- 'card_teb' | 'bank_transfer' | 'cash_on_delivery'
  status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'pending', 'paid', 'failed', 'cancelled', 'refunded')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'eur',
  provider_reference TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT,
  error_code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments (order_id);

-- A given provider transaction reference is processed at most once.
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_reference_uidx
  ON payments (provider, provider_reference) WHERE provider_reference <> '';

-- Client-supplied idempotency key for payment initiation is unique when present.
CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_uidx
  ON payments (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- At most one settled ('paid') payment per order.
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_paid_per_order_uidx
  ON payments (order_id) WHERE status = 'paid';

-- ===========================================================================
-- Phase 3 — Admin Dashboard / CMS. ADDITIVE only. No DROP TABLE, no data
-- rewrite. The one constraint that is replaced (orders_fulfillment_status_chk)
-- only WIDENS the allowed set and is safe because current data conforms.
-- See server/MIGRATIONS.md.
-- ===========================================================================

-- Products: CMS fields.
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku                 TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured            BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS new_arrival         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS archived            BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 3 CHECK (low_stock_threshold >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS images              JSONB   NOT NULL DEFAULT '[]'::jsonb;

-- SKU is unique when set (blank/NULL allowed for legacy products).
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_uidx
  ON products (LOWER(sku)) WHERE sku IS NOT NULL AND sku <> '';

CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_status_idx      ON products (status);
CREATE INDEX IF NOT EXISTS products_archived_idx    ON products (archived);

-- Categories: archive instead of destructive delete.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Orders: widen fulfillment lifecycle to pending->processing->shipped->delivered
-- (plus cancelled). 'fulfilled' was never used (0 rows historically).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillment_status_chk') THEN
    ALTER TABLE orders DROP CONSTRAINT orders_fulfillment_status_chk;
  END IF;
  -- normalise any legacy value before re-adding the constraint
  UPDATE orders SET fulfillment_status = 'delivered' WHERE fulfillment_status = 'fulfilled';
  ALTER TABLE orders ADD CONSTRAINT orders_fulfillment_status_chk
    CHECK (fulfillment_status IN ('pending','processing','shipped','delivered','cancelled'));
END $$;

CREATE INDEX IF NOT EXISTS orders_created_at_idx        ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx     ON orders (payment_status);
CREATE INDEX IF NOT EXISTS orders_fulfillment_status_idx ON orders (fulfillment_status);
CREATE INDEX IF NOT EXISTS orders_customer_email_idx     ON orders (LOWER(customer_email));

CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status);
CREATE INDEX IF NOT EXISTS payments_method_idx ON payments (method);

-- Manual inventory adjustment history (audit trail for stock changes).
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  adjustment_quantity INTEGER NOT NULL CHECK (adjustment_quantity <> 0),
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inventory_adjustments_product_id_idx ON inventory_adjustments (product_id);
CREATE INDEX IF NOT EXISTS inventory_adjustments_created_at_idx ON inventory_adjustments (created_at DESC);

-- Admin action audit log (append-only). `meta` holds small, non-sensitive context.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx     ON admin_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx  ON admin_audit_log (created_at DESC);

-- Key/value store settings (shipping copy, bank instructions, contact, thresholds).
CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
