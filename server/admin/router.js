'use strict';

const express = require('express');
const multer = require('multer');

const config = require('../config');
const { pool, query, withTransaction } = require('../db');
const { AppError } = require('../lib/errors');
const { str, intInRange } = require('../lib/validation');
const { writeAudit } = require('../lib/audit');
const { getStorage } = require('../lib/storage');
const { sniffImageMime } = require('../lib/imageType');
const { sendOrderConfirmationForOrder } = require('../lib/email/sendOrderConfirmation');
const { assertFulfillmentTransition, FULFILLMENT_STATUSES } = require('../lib/fulfillment');
const {
  slugify,
  orderNumber,
  productSelect,
  serializeProduct,
  serializeOrder,
  serializePayment,
} = require('../lib/serializers');
const payments = require('../payments');
const { requireAdmin, requireCsrf } = require('./auth');
const { adminWriteLimiter } = require('../lib/rateLimit');

const router = express.Router();

// ---- media upload: buffer in memory, storage service writes it -------------
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.has(file.mimetype)) return cb(null, true);
    return cb(new AppError('unsupported_file_type', 'Only JPEG, PNG, WebP, GIF or AVIF images are allowed.', 400));
  },
});

// ---- router-level guards --------------------------------------------------
router.use(requireAdmin);
router.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return adminWriteLimiter(req, res, (err) => (err ? next(err) : requireCsrf(req, res, next)));
});

const adminId = (req) => req.admin && req.admin.id;
const audit = (req, action, entityType, entityId, meta) =>
  writeAudit(null, { adminId: adminId(req), action, entityType, entityId, meta });

// ---- helpers -----------------------------------------------------------------
const pageParams = (req, def = 20, cap = 100) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || def, 1), cap);
  const page = Math.max(Number(req.query.page) || 1, 1);
  return { limit, offset: (page - 1) * limit, page };
};

function parseSizes(input) {
  if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean).slice(0, 40);
  if (typeof input === 'string') return input.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40);
  return [];
}

function parseImages(input) {
  if (!Array.isArray(input)) return null;
  const out = input
    .map((im, i) => ({
      url: typeof im === 'string' ? im.trim() : String(im?.url || '').trim(),
      position: Number.isFinite(Number(im?.position)) ? Number(im.position) : i,
    }))
    .filter((im) => im.url && im.url.length <= 1000)
    .slice(0, 12)
    .map((im, i) => ({ url: im.url, position: i }));
  return out;
}

function priceCentsFrom(body, { required = false } = {}) {
  const raw = body.priceCents ?? body.price_cents ?? (body.price !== undefined ? Number(body.price) * 100 : undefined);
  if (raw === undefined) {
    if (required) throw new AppError('invalid_input', 'Price is required.', 400);
    return null;
  }
  const cents = Math.round(Number(raw));
  if (!Number.isInteger(cents) || cents < 0 || cents > 100_000_00) {
    throw new AppError('invalid_input', 'Price is invalid.', 400);
  }
  return cents;
}

const boolOrNull = (v) => (v === undefined ? null : v === true || v === 'true');

async function loadSettings() {
  const rows = (await query('SELECT key, value FROM store_settings')).rows;
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

// ===========================================================================
// DASHBOARD
// ===========================================================================
router.get('/dashboard', async (_req, res) => {
  const [orderAgg, productAgg, recent, low] = await Promise.all([
    query(`
      SELECT
        COALESCE(SUM(total_cents) FILTER (WHERE payment_status='paid'),0)::bigint AS revenue_total,
        COALESCE(SUM(total_cents) FILTER (WHERE payment_status='paid' AND created_at >= date_trunc('day', now())),0)::bigint AS revenue_today,
        COALESCE(SUM(total_cents) FILTER (WHERE payment_status='paid' AND created_at >= date_trunc('month', now())),0)::bigint AS revenue_month,
        COUNT(*)::int AS orders_total,
        COUNT(*) FILTER (WHERE payment_status IN ('unpaid','pending'))::int AS orders_pending,
        COUNT(*) FILTER (WHERE payment_status='paid')::int AS orders_paid,
        COUNT(*) FILTER (WHERE fulfillment_status='cancelled')::int AS orders_cancelled
      FROM orders`),
    query(`
      SELECT
        COUNT(*)::int AS products_total,
        COUNT(*) FILTER (WHERE status='published' AND NOT archived)::int AS products_active,
        COUNT(*) FILTER (WHERE track_inventory AND stock = 0 AND NOT archived)::int AS products_out_of_stock,
        COUNT(*) FILTER (WHERE track_inventory AND stock > 0 AND stock <= low_stock_threshold AND NOT archived)::int AS products_low_stock
      FROM products`),
    query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 10`),
    query(`${productSelect} WHERE p.track_inventory AND p.stock <= p.low_stock_threshold AND NOT p.archived ORDER BY p.stock ASC, p.title ASC LIMIT 20`),
  ]);

  const o = orderAgg.rows[0];
  const p = productAgg.rows[0];
  res.json({
    sales: {
      currency: config.CURRENCY,
      revenueTotalCents: Number(o.revenue_total),
      revenueTodayCents: Number(o.revenue_today),
      revenueMonthCents: Number(o.revenue_month),
    },
    orders: {
      total: o.orders_total,
      pending: o.orders_pending,
      paid: o.orders_paid,
      cancelled: o.orders_cancelled,
    },
    products: {
      total: p.products_total,
      active: p.products_active,
      outOfStock: p.products_out_of_stock,
      lowStock: p.products_low_stock,
    },
    recentOrders: recent.rows.map((r) => ({
      id: r.id,
      number: orderNumber(r.id),
      customer: r.customer_name,
      email: r.customer_email,
      createdAt: r.created_at,
      totalCents: r.total_cents,
      currency: r.currency,
      paymentStatus: r.payment_status,
      fulfillmentStatus: r.fulfillment_status,
    })),
    lowStock: low.rows.map(serializeProduct).map((x) => ({
      id: x.id,
      title: x.title,
      sku: x.sku,
      stock: x.stock,
      lowStockThreshold: x.lowStockThreshold,
    })),
  });
});

// ===========================================================================
// PRODUCTS
// ===========================================================================
router.get('/products', async (req, res) => {
  const { limit, offset, page } = pageParams(req, 20, 100);
  const where = [];
  const params = [];
  const search = str(req.query.search, { field: 'search', max: 120, required: false });
  if (search) {
    params.push(`%${search}%`);
    where.push(`(p.title ILIKE $${params.length} OR COALESCE(p.sku,'') ILIKE $${params.length})`);
  }
  if (req.query.categoryId) {
    params.push(Number(req.query.categoryId));
    where.push(`p.category_id = $${params.length}`);
  }
  if (req.query.active === 'true') where.push(`(p.status='published' AND NOT p.archived)`);
  if (req.query.active === 'false') where.push(`(p.status<>'published' OR p.archived)`);
  if (req.query.archived === 'true') where.push(`p.archived`);
  if (req.query.archived === 'false' || req.query.archived === undefined) where.push(`NOT p.archived`);
  if (req.query.stock === 'out') where.push(`(p.track_inventory AND p.stock = 0)`);
  if (req.query.stock === 'low') where.push(`(p.track_inventory AND p.stock > 0 AND p.stock <= p.low_stock_threshold)`);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(
    (await query(`SELECT COUNT(*)::int AS n FROM products p ${whereSql}`, params)).rows[0].n
  );
  params.push(limit, offset);
  const rows = (
    await query(
      `${productSelect} ${whereSql} ORDER BY p.updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
  ).rows;
  res.json({ products: rows.map(serializeProduct), page, limit, total });
});

router.get('/products/:id', async (req, res) => {
  const id = intInRange(req.params.id, { field: 'Product id', min: 1, max: 2 ** 31 - 1 });
  const r = await query(`${productSelect} WHERE p.id = $1`, [id]);
  if (!r.rows[0]) throw new AppError('not_found', 'Product not found.', 404);
  res.json({ product: serializeProduct(r.rows[0]) });
});

async function assertSkuFree(sku, exceptId = null) {
  if (!sku) return;
  const r = await query(
    `SELECT id FROM products WHERE LOWER(sku) = LOWER($1) AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
    [sku, exceptId]
  );
  if (r.rows[0]) throw new AppError('sku_taken', 'That SKU is already used by another product.', 409);
}

router.post('/products', async (req, res) => {
  const body = req.body || {};
  const title = str(body.title || body.name, { field: 'Product name', min: 2, max: 160 });
  const description = str(body.description, { field: 'Description', min: 0, max: 8000, required: false });
  const sku = str(body.sku, { field: 'SKU', min: 0, max: 60, required: false });
  const priceCents = priceCentsFrom(body, { required: true });
  const categoryId = body.categoryId || body.category_id || body.category_ids?.[0] || null;
  const sizes = parseSizes(body.sizes);
  const images = parseImages(body.images) || (body.image_url ? [{ url: String(body.image_url), position: 0 }] : []);
  const trackInventory = body.trackInventory === true || body.track_inventory === true;
  const settings = await loadSettings();
  const lowStockDefault = Number(settings.low_stock_threshold_default?.value) || 3;
  const lowStockThreshold = Number.isFinite(Number(body.lowStockThreshold))
    ? Math.max(0, Math.trunc(Number(body.lowStockThreshold)))
    : lowStockDefault;
  const stock = Number.isFinite(Number(body.stock)) ? Math.max(0, Math.trunc(Number(body.stock))) : 0;
  const status = body.active === false || body.status === 'draft' ? 'draft' : 'published';

  if (categoryId != null) {
    const c = await query('SELECT 1 FROM categories WHERE id = $1', [Number(categoryId)]);
    if (!c.rows[0]) throw new AppError('invalid_input', 'Unknown category.', 400);
  }
  await assertSkuFree(sku);

  const inserted = await query(
    `INSERT INTO products
       (title, handle, description, sku, price_cents, image_url, images, status, stock, category_id,
        track_inventory, sizes, featured, new_arrival, archived, low_stock_threshold)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12::jsonb,$13,$14,FALSE,$15)
     RETURNING id`,
    [
      title,
      body.handle || slugify(title),
      description,
      sku || null,
      priceCents,
      images[0]?.url || '',
      JSON.stringify(images),
      status,
      stock,
      categoryId ? Number(categoryId) : null,
      trackInventory,
      JSON.stringify(sizes),
      body.featured === true,
      body.newArrival === true || body.new_arrival === true,
      lowStockThreshold,
    ]
  );
  const row = (await query(`${productSelect} WHERE p.id = $1`, [inserted.rows[0].id])).rows[0];
  await audit(req, 'product.created', 'product', row.id, { title, sku: sku || null, priceCents, status });
  res.status(201).json({ product: serializeProduct(row) });
});

async function updateProduct(req, res) {
  const id = intInRange(req.params.id, { field: 'Product id', min: 1, max: 2 ** 31 - 1 });
  const body = req.body || {};
  const existing = (await query(`SELECT * FROM products WHERE id = $1`, [id])).rows[0];
  if (!existing) throw new AppError('not_found', 'Product not found.', 404);

  const sets = [];
  const params = [];
  const set = (col, val) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (body.title !== undefined || body.name !== undefined) {
    set('title', str(body.title ?? body.name, { field: 'Product name', min: 2, max: 160 }));
  }
  if (body.handle !== undefined) set('handle', slugify(body.handle));
  if (body.description !== undefined) {
    set('description', str(body.description, { field: 'Description', min: 0, max: 8000, required: false }));
  }
  if (body.sku !== undefined) {
    const sku = str(body.sku, { field: 'SKU', min: 0, max: 60, required: false });
    await assertSkuFree(sku, id);
    set('sku', sku || null);
  }
  const priceCents = priceCentsFrom(body);
  if (priceCents !== null) set('price_cents', priceCents);

  if (body.categoryId !== undefined || body.category_id !== undefined) {
    const cid = body.categoryId ?? body.category_id;
    if (cid == null || cid === '') set('category_id', null);
    else {
      const c = await query('SELECT 1 FROM categories WHERE id = $1', [Number(cid)]);
      if (!c.rows[0]) throw new AppError('invalid_input', 'Unknown category.', 400);
      set('category_id', Number(cid));
    }
  }
  if (body.sizes !== undefined) set('sizes', JSON.stringify(parseSizes(body.sizes)));
  const imgs = parseImages(body.images);
  if (imgs !== null) {
    set('images', JSON.stringify(imgs));
    set('image_url', imgs[0]?.url || '');
  }
  if (body.trackInventory !== undefined || body.track_inventory !== undefined) {
    set('track_inventory', body.trackInventory === true || body.track_inventory === true);
  }
  if (body.stock !== undefined) {
    // Direct stock set from the product form is allowed but recorded; the
    // dedicated inventory-adjustments endpoint is preferred for +/- changes.
    set('stock', Math.max(0, Math.trunc(Number(body.stock) || 0)));
  }
  if (body.lowStockThreshold !== undefined) {
    set('low_stock_threshold', Math.max(0, Math.trunc(Number(body.lowStockThreshold) || 0)));
  }
  const featured = boolOrNull(body.featured);
  if (featured !== null) set('featured', featured);
  const newArrival = boolOrNull(body.newArrival ?? body.new_arrival);
  if (newArrival !== null) set('new_arrival', newArrival);
  if (body.active !== undefined) set('status', body.active === true ? 'published' : 'draft');
  else if (body.status === 'draft' || body.status === 'published') set('status', body.status);

  if (!sets.length) throw new AppError('invalid_input', 'Nothing to update.', 400);
  params.push(id);
  await query(`UPDATE products SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
  const row = (await query(`${productSelect} WHERE p.id = $1`, [id])).rows[0];
  await audit(req, 'product.updated', 'product', id, { fields: sets.map((s) => s.split(' = ')[0]) });
  res.json({ product: serializeProduct(row) });
}
router.patch('/products/:id', updateProduct);
router.post('/products/:id', updateProduct); // backward-compatible alias

router.post('/products/:id/archive', async (req, res) => {
  const id = intInRange(req.params.id, { field: 'Product id', min: 1, max: 2 ** 31 - 1 });
  // Archiving hides the product from the storefront and the default admin list
  // (the storefront query requires `NOT archived`). The product's own `status`
  // is left untouched so unarchiving restores it exactly.
  const r = await query(
    `UPDATE products SET archived = TRUE, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id]
  );
  if (!r.rows[0]) throw new AppError('not_found', 'Product not found.', 404);
  await audit(req, 'product.archived', 'product', id, {});
  const row = (await query(`${productSelect} WHERE p.id = $1`, [id])).rows[0];
  res.json({ product: serializeProduct(row) });
});

router.post('/products/:id/unarchive', async (req, res) => {
  const id = intInRange(req.params.id, { field: 'Product id', min: 1, max: 2 ** 31 - 1 });
  const r = await query(
    `UPDATE products SET archived = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id]
  );
  if (!r.rows[0]) throw new AppError('not_found', 'Product not found.', 404);
  await audit(req, 'product.unarchived', 'product', id, {});
  const row = (await query(`${productSelect} WHERE p.id = $1`, [id])).rows[0];
  res.json({ product: serializeProduct(row) });
});

router.delete('/products/:id', async (req, res) => {
  const id = intInRange(req.params.id, { field: 'Product id', min: 1, max: 2 ** 31 - 1 });
  const ref = await query('SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1', [id]);
  if (ref.rows[0]) {
    throw new AppError(
      'product_referenced',
      'This product appears in historical orders and cannot be deleted. Archive it instead.',
      409
    );
  }
  const r = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
  if (!r.rows[0]) throw new AppError('not_found', 'Product not found.', 404);
  await audit(req, 'product.deleted', 'product', id, {});
  res.status(204).end();
});

// ---- INVENTORY -----------------------------------------------------------
router.post('/products/:id/inventory-adjustments', async (req, res) => {
  const id = intInRange(req.params.id, { field: 'Product id', min: 1, max: 2 ** 31 - 1 });
  const adjustment = Number(req.body?.adjustment);
  if (!Number.isInteger(adjustment) || adjustment === 0 || Math.abs(adjustment) > 1_000_000) {
    throw new AppError('invalid_input', 'Adjustment must be a non-zero integer.', 400);
  }
  const reason = str(req.body?.reason, { field: 'Reason', min: 0, max: 200, required: false });

  const result = await withTransaction(async (client) => {
    const p = (await client.query(`SELECT id, title, stock FROM products WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!p) throw new AppError('not_found', 'Product not found.', 404);
    const before = Number(p.stock);
    const after = before + adjustment;
    if (after < 0) {
      throw new AppError('stock_below_zero', `Adjustment would drop stock below zero (have ${before}).`, 409);
    }
    await client.query(`UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2`, [after, id]);
    const adj = (
      await client.query(
        `INSERT INTO inventory_adjustments
           (product_id, admin_id, quantity_before, quantity_after, adjustment_quantity, reason)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, adminId(req) || null, before, after, adjustment, reason]
      )
    ).rows[0];
    await writeAudit(client, {
      adminId: adminId(req),
      action: 'inventory.adjusted',
      entityType: 'product',
      entityId: id,
      meta: { before, after, adjustment, reason },
    });
    return { adj, before, after };
  });

  res.status(201).json({
    productId: id,
    quantityBefore: result.before,
    quantityAfter: result.after,
    adjustmentQuantity: adjustment,
    adjustmentId: result.adj.id,
  });
});

router.get('/inventory', async (req, res) => {
  const { limit, offset, page } = pageParams(req, 50, 200);
  const rows = (
    await query(
      `${productSelect} WHERE NOT p.archived ORDER BY p.track_inventory DESC, p.stock ASC, p.title ASC LIMIT $1 OFFSET $2`,
      [limit, offset]
    )
  ).rows;
  const total = Number((await query(`SELECT COUNT(*)::int n FROM products WHERE NOT archived`)).rows[0].n);
  res.json({
    items: rows.map((r) => {
      const s = serializeProduct(r);
      return {
        id: s.id,
        title: s.title,
        sku: s.sku,
        stock: s.stock,
        trackInventory: s.trackInventory,
        lowStockThreshold: s.lowStockThreshold,
        lowStock: s.lowStock,
        status: s.status,
        active: s.active,
      };
    }),
    page,
    limit,
    total,
  });
});

router.get('/inventory/adjustments', async (req, res) => {
  const { limit, offset, page } = pageParams(req, 50, 200);
  const params = [];
  let whereSql = '';
  if (req.query.productId) {
    params.push(Number(req.query.productId));
    whereSql = `WHERE a.product_id = $1`;
  }
  params.push(limit, offset);
  const rows = (
    await query(
      `SELECT a.*, p.title AS product_title, ad.email AS admin_email
         FROM inventory_adjustments a
         LEFT JOIN products p ON p.id = a.product_id
         LEFT JOIN admins ad ON ad.id = a.admin_id
         ${whereSql}
        ORDER BY a.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
  ).rows;
  res.json({
    adjustments: rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      productTitle: r.product_title,
      quantityBefore: r.quantity_before,
      quantityAfter: r.quantity_after,
      adjustmentQuantity: r.adjustment_quantity,
      reason: r.reason,
      adminEmail: r.admin_email || null,
      createdAt: r.created_at,
    })),
    page,
    limit,
  });
});

// ===========================================================================
// ORDERS
// ===========================================================================
router.get('/orders', async (req, res) => {
  const { limit, offset, page } = pageParams(req, 25, 100);
  const params = [];
  const where = [];
  const search = str(req.query.search, { field: 'search', max: 120, required: false });
  if (search) {
    const m = search.match(/^BK-?0*(\d+)$/i);
    if (m) {
      params.push(Number(m[1]));
      where.push(`o.id = $${params.length}`);
    } else {
      params.push(`%${search}%`);
      where.push(`(o.customer_name ILIKE $${params.length} OR o.customer_email ILIKE $${params.length})`);
    }
  }
  if (req.query.paymentStatus) {
    params.push(String(req.query.paymentStatus));
    where.push(`o.payment_status = $${params.length}`);
  }
  if (req.query.fulfillmentStatus) {
    params.push(String(req.query.fulfillmentStatus));
    where.push(`o.fulfillment_status = $${params.length}`);
  }
  if (req.query.paymentMethod) {
    params.push(String(req.query.paymentMethod));
    where.push(`o.payment_method = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number((await query(`SELECT COUNT(*)::int n FROM orders o ${whereSql}`, params)).rows[0].n);
  params.push(limit, offset);
  const orders = (
    await query(
      `SELECT * FROM orders o ${whereSql} ORDER BY o.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
  ).rows;
  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      number: orderNumber(o.id),
      createdAt: o.created_at,
      customer: { name: o.customer_name, email: o.customer_email },
      totalCents: o.total_cents,
      currency: o.currency,
      paymentStatus: o.payment_status,
      fulfillmentStatus: o.fulfillment_status,
      paymentMethod: o.payment_method,
      emailStatus: o.confirmation_email_status || 'pending',
    })),
    page,
    limit,
    total,
  });
});

router.get('/orders/:id', async (req, res) => {
  const id = intInRange(req.params.id, { field: 'Order id', min: 1, max: 2 ** 31 - 1 });
  const o = (await query(`SELECT * FROM orders WHERE id = $1`, [id])).rows[0];
  if (!o) throw new AppError('not_found', 'Order not found.', 404);
  const items = (await query(`SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`, [id])).rows;
  const pays = (await query(`SELECT * FROM payments WHERE order_id = $1 ORDER BY id DESC`, [id])).rows;
  res.json({ order: serializeOrder(o, items, pays) });
});

router.patch('/orders/:id', async (req, res) => {
  const id = intInRange(req.params.id, { field: 'Order id', min: 1, max: 2 ** 31 - 1 });
  const body = req.body || {};
  const o = (await query(`SELECT * FROM orders WHERE id = $1`, [id])).rows[0];
  if (!o) throw new AppError('not_found', 'Order not found.', 404);

  let changed = false;

  const nextFulfillment = body.fulfillmentStatus ?? body.fulfillment_status;
  if (nextFulfillment !== undefined) {
    assertFulfillmentTransition(o.fulfillment_status, String(nextFulfillment));
    if (String(nextFulfillment) !== o.fulfillment_status) {
      await query(`UPDATE orders SET fulfillment_status = $1, updated_at = NOW() WHERE id = $2`, [
        String(nextFulfillment),
        id,
      ]);
      await audit(req, 'order.fulfillment_changed', 'order', id, {
        from: o.fulfillment_status,
        to: String(nextFulfillment),
      });
      changed = true;
    }
  }

  // Payment METHOD change — offline methods only (bank transfer <-> cash on
  // delivery), and only while the order is still open. A card order is never
  // switched to an offline method here.
  const nextMethod = body.paymentMethod ?? body.payment_method;
  if (nextMethod !== undefined) {
    const method = String(nextMethod);
    const OFFLINE_METHODS = [
      config.PAYMENT_METHODS.BANK_TRANSFER,
      config.PAYMENT_METHODS.CASH_ON_DELIVERY,
    ];
    if (!OFFLINE_METHODS.includes(method)) {
      throw new AppError(
        'invalid_payment_method',
        'Payment method can only be set to bank transfer or cash on delivery.',
        400
      );
    }
    if (o.payment_method === config.PAYMENT_METHODS.CARD_TEB) {
      throw new AppError(
        'card_payment_not_manual',
        'A card order cannot be switched to an offline method here.',
        409
      );
    }
    if (o.payment_status === 'paid' || o.payment_status === 'refunded') {
      throw new AppError(
        'order_settled',
        'This order is already settled — the payment method cannot be changed.',
        409
      );
    }
    if (method !== o.payment_method) {
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE orders SET payment_method = $1, updated_at = NOW() WHERE id = $2`,
          [method, id]
        );
        // keep the still-open payment row in step; never touch a settled one
        await client.query(
          `UPDATE payments SET method = $1, provider = 'offline', updated_at = NOW()
             WHERE order_id = $2 AND status IN ('unpaid', 'pending', 'failed', 'cancelled')`,
          [method, id]
        );
      });
      await audit(req, 'order.payment_method_changed', 'order', id, {
        from: o.payment_method,
        to: method,
      });
    }
    changed = true;
  }

  // Payment status changes ONLY through the payment state machine, and only
  // for offline methods. Card/TEB can never be marked paid this way.
  const nextPayment = body.paymentStatus ?? body.payment_status;
  if (nextPayment !== undefined) {
    const currentMethod =
      (await query(`SELECT payment_method FROM orders WHERE id = $1`, [id])).rows[0]?.payment_method ||
      o.payment_method;
    if (currentMethod === config.PAYMENT_METHODS.CARD_TEB) {
      throw new AppError(
        'card_payment_not_manual',
        'Card payments cannot be set manually. They are confirmed by the payment provider.',
        409
      );
    }
    await payments.adminSetPaymentOutcome({ orderId: id, status: String(nextPayment) });
    await audit(req, 'order.payment_status_changed', 'order', id, {
      to: String(nextPayment),
      method: currentMethod,
    });
    changed = true;
  }

  if (!changed) throw new AppError('invalid_input', 'Nothing to update.', 400);
  const fresh = (await query(`SELECT * FROM orders WHERE id = $1`, [id])).rows[0];
  const items = (await query(`SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`, [id])).rows;
  const pays = (await query(`SELECT * FROM payments WHERE order_id = $1 ORDER BY id DESC`, [id])).rows;
  res.json({ order: serializeOrder(fresh, items, pays) });
});

// Re-send the order-confirmation email for ONE existing order. The recipient is
// always the order's stored customer_email — never a request parameter — so
// this can never be used to mail an arbitrary address. Guards: requireAdmin +
// CSRF + adminWriteLimiter (router-level) + a per-order attempt cap inside the
// orchestrator. Audited without any address or email content.
router.post('/orders/:id/resend-confirmation', async (req, res) => {
  const id = intInRange(req.params.id, { field: 'Order id', min: 1, max: 2 ** 31 - 1 });
  const o = (await query(`SELECT id FROM orders WHERE id = $1`, [id])).rows[0];
  if (!o) throw new AppError('not_found', 'Order not found.', 404);

  const result = await sendOrderConfirmationForOrder(id, { force: true, trigger: 'admin_resend' });
  await audit(req, 'order.confirmation_email_resent', 'order', id, {
    result: result.status,
    category: result.category || null,
  });

  if (result.status === 'failed') {
    throw new AppError('email_send_failed', 'The confirmation email could not be sent.', 502, {
      category: result.category || 'unknown',
    });
  }

  const fresh = (await query(`SELECT * FROM orders WHERE id = $1`, [id])).rows[0];
  const items = (await query(`SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`, [id])).rows;
  const pays = (await query(`SELECT * FROM payments WHERE order_id = $1 ORDER BY id DESC`, [id])).rows;
  res.json({ order: serializeOrder(fresh, items, pays), email: { status: result.status } });
});

// ===========================================================================
// PAYMENTS
// ===========================================================================
router.get('/payments', async (req, res) => {
  const { limit, offset, page } = pageParams(req, 25, 100);
  const params = [];
  const where = [];
  for (const [q, col] of [
    ['status', 'status'],
    ['method', 'method'],
    ['provider', 'provider'],
  ]) {
    if (req.query[q]) {
      params.push(String(req.query[q]));
      where.push(`${col} = $${params.length}`);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number((await query(`SELECT COUNT(*)::int n FROM payments ${whereSql}`, params)).rows[0].n);
  params.push(limit, offset);
  const rows = (
    await query(
      `SELECT * FROM payments ${whereSql} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
  ).rows;
  res.json({ payments: rows.map(serializePayment), page, limit, total });
});

router.post('/payments/:id/confirm', async (req, res) => {
  const id = intInRange(req.params.id, { field: 'Payment id', min: 1, max: 2 ** 31 - 1 });
  const p = (await query(`SELECT * FROM payments WHERE id = $1`, [id])).rows[0];
  if (!p) throw new AppError('not_found', 'Payment not found.', 404);
  if (p.method === config.PAYMENT_METHODS.CARD_TEB || p.provider === 'teb') {
    throw new AppError(
      'card_payment_not_manual',
      'Card payments are confirmed by the provider, not manually.',
      409
    );
  }
  const outcome = str(req.body?.status, { field: 'status', max: 20, required: false }) || 'paid';
  const result = await payments.adminSetPaymentOutcome({ orderId: p.order_id, status: outcome });
  await audit(req, 'payment.confirmed', 'payment', id, { orderId: p.order_id, to: result.status, method: p.method });
  const fresh = (await query(`SELECT * FROM payments WHERE id = $1`, [id])).rows[0];
  res.json({ payment: serializePayment(fresh) });
});

// ===========================================================================
// CUSTOMERS  (derived from orders — no customer auth in this phase)
// ===========================================================================
router.get('/customers', async (req, res) => {
  const { limit, offset, page } = pageParams(req, 25, 100);
  const params = [];
  let whereSql = '';
  const search = str(req.query.search, { field: 'search', max: 120, required: false });
  if (search) {
    params.push(`%${search}%`);
    whereSql = `WHERE customer_name ILIKE $1 OR customer_email ILIKE $1`;
  }
  params.push(limit, offset);
  const rows = (
    await query(
      `SELECT LOWER(customer_email) AS email,
              MAX(customer_name) AS name,
              MAX(phone) AS phone,
              COUNT(*)::int AS order_count,
              COALESCE(SUM(total_cents) FILTER (WHERE payment_status='paid'),0)::bigint AS total_spent_cents,
              MAX(created_at) AS last_order_at
         FROM orders ${whereSql}
        GROUP BY LOWER(customer_email)
        ORDER BY last_order_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
  ).rows;
  res.json({
    customers: rows.map((r) => ({
      email: r.email,
      name: r.name,
      phone: r.phone,
      orderCount: r.order_count,
      totalSpentCents: Number(r.total_spent_cents),
      lastOrderAt: r.last_order_at,
    })),
    page,
    limit,
  });
});

router.get('/customers/:email', async (req, res) => {
  const email = str(req.params.email, { field: 'email', max: 160 }).toLowerCase();
  const orders = (
    await query(`SELECT * FROM orders WHERE LOWER(customer_email) = $1 ORDER BY created_at DESC LIMIT 100`, [email])
  ).rows;
  if (!orders.length) throw new AppError('not_found', 'No orders for that customer.', 404);
  const totalSpent = orders
    .filter((o) => o.payment_status === 'paid')
    .reduce((s, o) => s + o.total_cents, 0);
  res.json({
    customer: {
      email,
      name: orders[0].customer_name,
      phone: orders[0].phone,
      orderCount: orders.length,
      totalSpentCents: totalSpent,
      lastOrderAt: orders[0].created_at,
    },
    orders: orders.map((o) => ({
      id: o.id,
      number: orderNumber(o.id),
      createdAt: o.created_at,
      totalCents: o.total_cents,
      currency: o.currency,
      paymentStatus: o.payment_status,
      fulfillmentStatus: o.fulfillment_status,
    })),
  });
});

// ===========================================================================
// CATEGORIES
// ===========================================================================
async function listCategories(_req, res) {
  const rows = (
    await query(
      `SELECT c.*, COUNT(p.id)::int AS product_count
         FROM categories c LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.id ORDER BY c.name`
    )
  ).rows;
  const categories = rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    archived: Boolean(c.archived),
    productCount: c.product_count,
    createdAt: c.created_at,
  }));
  res.json({ categories, product_categories: categories });
}
router.get('/categories', listCategories);
router.get('/product-categories', listCategories); // backward-compatible alias

async function createCategory(req, res) {
  const name = str(req.body?.name, { field: 'Category name', min: 2, max: 80 });
  const slug = slugify(name);
  // categories has UNIQUE on BOTH name and slug — check up front for a clean 409.
  const dupe = await query(
    `SELECT id FROM categories WHERE LOWER(name) = LOWER($1) OR slug = $2 LIMIT 1`,
    [name, slug]
  );
  if (dupe.rows[0]) throw new AppError('category_exists', 'That category already exists.', 409);
  const r = await query(
    `INSERT INTO categories (name, slug) VALUES ($1,$2)
     ON CONFLICT DO NOTHING RETURNING *`,
    [name, slug]
  );
  if (!r.rows[0]) throw new AppError('category_exists', 'That category already exists.', 409);
  await audit(req, 'category.created', 'category', r.rows[0].id, { name });
  res.status(201).json({ category: r.rows[0], product_category: r.rows[0] });
}
router.post('/categories', createCategory);
router.post('/product-categories', createCategory); // backward-compatible alias

router.patch('/categories/:id', async (req, res) => {
  const id = intInRange(req.params.id, { field: 'Category id', min: 1, max: 2 ** 31 - 1 });
  const name = str(req.body?.name, { field: 'Category name', min: 2, max: 80 });
  const slug = slugify(name);
  const dupe = await query(
    `SELECT id FROM categories WHERE (LOWER(name) = LOWER($1) OR slug = $2) AND id <> $3 LIMIT 1`,
    [name, slug, id]
  );
  if (dupe.rows[0]) throw new AppError('category_exists', 'Another category already uses that name.', 409);
  const r = await query(
    `UPDATE categories SET name = $1, slug = $2 WHERE id = $3 RETURNING *`,
    [name, slug, id]
  );
  if (!r.rows[0]) throw new AppError('not_found', 'Category not found.', 404);
  await audit(req, 'category.updated', 'category', id, { name });
  res.json({ category: r.rows[0] });
});

router.post('/categories/:id/archive', async (req, res) => {
  const id = intInRange(req.params.id, { field: 'Category id', min: 1, max: 2 ** 31 - 1 });
  const r = await query(`UPDATE categories SET archived = TRUE WHERE id = $1 RETURNING *`, [id]);
  if (!r.rows[0]) throw new AppError('not_found', 'Category not found.', 404);
  await audit(req, 'category.archived', 'category', id, {});
  res.json({ category: r.rows[0] });
});
router.post('/categories/:id/unarchive', async (req, res) => {
  const id = intInRange(req.params.id, { field: 'Category id', min: 1, max: 2 ** 31 - 1 });
  const r = await query(`UPDATE categories SET archived = FALSE WHERE id = $1 RETURNING *`, [id]);
  if (!r.rows[0]) throw new AppError('not_found', 'Category not found.', 404);
  await audit(req, 'category.unarchived', 'category', id, {});
  res.json({ category: r.rows[0] });
});

// ===========================================================================
// UPLOADS
// ===========================================================================
router.post('/uploads', upload.array('files', 6), async (req, res) => {
  const storage = getStorage();
  const files = req.files || [];
  if (!files.length) throw new AppError('no_files', 'No image files were provided.', 400);
  // Product images are loaded by the storefront on a different origin, so
  // return absolute URLs. MEDIA_PUBLIC_BASE_URL overrides the request origin
  // (set it to the CDN / object-storage base in production).
  const base = (process.env.MEDIA_PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  // Content-based check: the real container (magic bytes) must be a raster
  // image type we serve AND agree with the declared MIME. Defeats a renamed
  // script / HTML / SVG and a spoofed Content-Type; multer already filtered
  // by declared MIME and the storage layer by extension.
  for (const f of files) {
    const real = sniffImageMime(f.buffer);
    if (!real || !ALLOWED_IMAGE_MIME.has(real) || real !== f.mimetype) {
      throw new AppError(
        'file_content_mismatch',
        'One of the files is not a valid image, or its type does not match its contents.',
        400
      );
    }
  }
  const saved = [];
  try {
    for (const f of files) {
      const s = await storage.save({ buffer: f.buffer, mime: f.mimetype });
      saved.push({ key: s.key, url: /^https?:\/\//.test(s.url) ? s.url : `${base}${s.url}` });
    }
  } catch (err) {
    // A partial multi-file upload must not orphan the objects already written.
    await Promise.allSettled(saved.map((s) => storage.remove(s.key)));
    throw err;
  }
  await audit(req, 'media.uploaded', 'media', '', { count: saved.length, driver: storage.driver });
  res.json({ files: saved, storageDriver: storage.driver });
});

// ===========================================================================
// STORE SETTINGS  (never exposes or accepts secrets)
// ===========================================================================
const SETTING_KEYS = ['bank_transfer', 'contact', 'low_stock_threshold_default'];

router.get('/settings', async (_req, res) => {
  const stored = await loadSettings();
  res.json({
    settings: {
      bank_transfer: stored.bank_transfer || {},
      contact: stored.contact || {},
      low_stock_threshold_default: stored.low_stock_threshold_default ?? 3,
    },
    // Read-only: these come from environment configuration, shown for reference.
    shippingConfig: {
      currency: config.CURRENCY,
      supportedCountries: config.SUPPORTED_COUNTRIES,
      shippingRatesCents: config.SHIPPING_RATES_CENTS,
      taxRateBps: config.TAX_RATE_BPS,
      codEnabled: config.ENABLE_COD,
      readOnly: true,
      note: 'Shipping rates, supported countries and tax are configured via environment variables.',
    },
  });
});

router.put('/settings', async (req, res) => {
  const body = req.body || {};
  const updates = [];
  if (body.bank_transfer !== undefined) {
    const bt = body.bank_transfer || {};
    updates.push([
      'bank_transfer',
      {
        holder: str(bt.holder, { field: 'Account holder', max: 120, required: false }),
        iban: str(bt.iban, { field: 'IBAN', max: 60, required: false }),
        bank: str(bt.bank, { field: 'Bank name', max: 120, required: false }),
        swift: str(bt.swift, { field: 'SWIFT', max: 20, required: false }),
        instructions: str(bt.instructions, { field: 'Instructions', max: 1000, required: false }),
      },
    ]);
  }
  if (body.contact !== undefined) {
    const c = body.contact || {};
    updates.push([
      'contact',
      {
        email: str(c.email, { field: 'Contact email', max: 160, required: false }),
        phone: str(c.phone, { field: 'Contact phone', max: 40, required: false }),
        address: str(c.address, { field: 'Address', max: 300, required: false }),
      },
    ]);
  }
  if (body.low_stock_threshold_default !== undefined) {
    const n = Math.max(0, Math.trunc(Number(body.low_stock_threshold_default)));
    if (!Number.isInteger(n)) throw new AppError('invalid_input', 'Threshold must be an integer.', 400);
    updates.push(['low_stock_threshold_default', n]);
  }
  if (!updates.length) throw new AppError('invalid_input', 'No recognised settings to update.', 400);

  for (const [key, value] of updates) {
    if (!SETTING_KEYS.includes(key)) continue;
    await query(
      `INSERT INTO store_settings (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  }
  await audit(req, 'settings.updated', 'settings', '', { keys: updates.map((u) => u[0]) });
  const stored = await loadSettings();
  res.json({ settings: stored });
});

// ===========================================================================
// AUDIT LOG (read-only)
// ===========================================================================
router.get('/audit-log', async (req, res) => {
  const { limit, offset, page } = pageParams(req, 50, 200);
  const rows = (
    await query(
      `SELECT l.*, a.email AS admin_email FROM admin_audit_log l
       LEFT JOIN admins a ON a.id = l.admin_id
       ORDER BY l.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    )
  ).rows;
  res.json({
    entries: rows.map((r) => ({
      id: r.id,
      adminEmail: r.admin_email || null,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      meta: r.meta,
      createdAt: r.created_at,
    })),
    page,
    limit,
  });
});

module.exports = { adminRouter: router, FULFILLMENT_STATUSES };
