'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');

const config = require('./config');
const { pool, query, withTransaction, initDatabase } = require('./db');
const { AppError, errorHandler, notFoundHandler } = require('./lib/errors');
const { validateOrderInput, str } = require('./lib/validation');
const { computeOrderTotals } = require('./lib/pricing');
const { orderFingerprint } = require('./lib/idempotency');
const { cookieParser } = require('./lib/cookies');
const { serializeProduct, productSelect, orderNumber } = require('./lib/serializers');
const { setAuthCookies, clearAuthCookies, newCsrfToken, requireAdmin, CSRF_COOKIE } = require('./admin/auth');
const { adminRouter } = require('./admin/router');
const { getStorage } = require('./lib/storage');
const { getEmailService } = require('./lib/email');
const { sendOrderConfirmationForOrder } = require('./lib/email/sendOrderConfirmation');
const {
  authLimiter,
  orderLimiter,
  paymentLimiter,
} = require('./lib/rateLimit');
const payments = require('./payments');

const app = express();
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// Constant-work comparison target so a missing account and a wrong password
// take the same code path (no user-enumeration via timing / early return).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('bukur~no~such~account~placeholder', 10);

// Correct client IPs behind a single reverse proxy (Render/Vercel) for rate limiting.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Security headers. CORP is relaxed so the storefront (different origin) can
// still load product images served from /uploads.
// ---------------------------------------------------------------------------
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ---------------------------------------------------------------------------
// CORS — explicit allowlist. No wildcard, no reflect-all.
// ---------------------------------------------------------------------------
const corsOptions = {
  origin(origin, callback) {
    // Same-origin / server-to-server / curl (no Origin header) is allowed.
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, '');
    if (config.CLIENT_ORIGINS.includes(normalized)) return callback(null, true);
    return callback(new AppError('cors_denied', 'Origin not allowed.', 403));
  },
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadDir));

// ---------------------------------------------------------------------------
// Health / root
// ---------------------------------------------------------------------------
app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'bukur-api' });
});

app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, service: 'bukur-api' });
  } catch (_error) {
    res.status(503).json({ ok: false, message: 'Database unavailable.' });
  }
});

// ---------------------------------------------------------------------------
// Admin authentication — HttpOnly cookie session + double-submit CSRF token.
// The JWT is never returned to the browser as JSON and is never readable by JS.
// ---------------------------------------------------------------------------
app.post('/auth/user/emailpass', authLimiter, async (req, res) => {
  const email = str(req.body?.email, { field: 'Email', max: 160, required: false }).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const result = await query('SELECT * FROM admins WHERE LOWER(email) = LOWER($1)', [email]);
  const admin = result.rows[0];
  // Always run a bcrypt comparison (against a dummy hash when the account does
  // not exist) so response timing does not reveal which emails are admins.
  const passwordOk = await bcrypt.compare(password, admin ? admin.password_hash : DUMMY_PASSWORD_HASH);
  if (!admin || !passwordOk) {
    throw new AppError('invalid_credentials', 'Invalid email or password.', 401);
  }
  const csrfToken = setAuthCookies(res, admin);
  res.json({ ok: true, admin: { id: admin.id, email: admin.email }, csrfToken });
});

app.post('/auth/admin/register', authLimiter, async (req, res) => {
  if (!config.ALLOW_ADMIN_REGISTER) {
    throw new AppError('registration_disabled', 'Admin registration is disabled.', 403);
  }
  const email = str(req.body?.email, { field: 'Email', max: 160 }).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length < 12) {
    throw new AppError('weak_password', 'Password must be at least 12 characters.', 400);
  }
  const result = await query(
    'INSERT INTO admins (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id, email',
    [email, await bcrypt.hash(password, 12)]
  );
  if (!result.rows[0]) throw new AppError('email_taken', 'That email is already registered.', 409);
  res.status(201).json({ admin: result.rows[0] });
});

app.get('/auth/session', requireAdmin, (req, res) => {
  // Re-issue the CSRF cookie if it is missing (e.g. after a browser restart).
  let csrfToken = (req.cookies && req.cookies[CSRF_COOKIE]) || '';
  if (!csrfToken) {
    csrfToken = newCsrfToken();
    const sameSite = config.ADMIN_COOKIE_SAMESITE;
    res.cookie(CSRF_COOKIE, csrfToken, {
      path: '/',
      sameSite,
      secure: config.IS_PROD || sameSite === 'none',
      httpOnly: false,
      maxAge: 12 * 60 * 60 * 1000,
    });
  }
  res.json({ authenticated: true, admin: { id: req.admin.id, email: req.admin.email }, csrfToken });
});
app.post('/auth/session', requireAdmin, (req, res) =>
  res.json({ authenticated: true, admin: { id: req.admin.id, email: req.admin.email } })
);
app.delete('/auth/session', (_req, res) => {
  clearAuthCookies(res);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Products (public read) — published, not archived.
// ---------------------------------------------------------------------------
app.get('/store/products', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 100);
  const result = await query(
    `${productSelect} WHERE p.status = 'published' AND NOT p.archived ORDER BY p.created_at DESC LIMIT $1`,
    [limit]
  );
  res.json({ products: result.rows.map(serializeProduct) });
});

// ---------------------------------------------------------------------------
// Admin API — authentication, authorization, CSRF and rate limiting are all
// enforced inside the router (server/admin/router.js).
// ---------------------------------------------------------------------------
app.use('/admin', adminRouter);

// ===========================================================================
// ORDERS — server is authoritative for pricing, stock and status.
// ===========================================================================
const publicOrderResponse = (order, totals, requiresPayment, emailStatus = 'pending') => ({
  id: orderNumber(order.id),
  orderNumber: orderNumber(order.id),
  orderId: order.id,
  paymentStatus: order.payment_status,
  paymentMethod: order.payment_method,
  requiresPayment,
  totals: {
    currency: totals.currency,
    subtotalCents: totals.subtotalCents,
    shippingCents: totals.shippingCents,
    discountCents: totals.discountCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
  },
  // Order success never depends on this. 'sent' | 'failed' | 'skipped' | 'pending'.
  email: { status: emailStatus },
  emailSent: emailStatus === 'sent',
});

const existingOrderResponse = (o) => {
  const totals = {
    currency: o.currency,
    subtotalCents: o.subtotal_cents,
    shippingCents: o.shipping_cents,
    discountCents: o.discount_cents,
    taxCents: o.tax_cents,
    totalCents: o.total_cents,
  };
  return {
    ...publicOrderResponse(
      o,
      totals,
      o.payment_method === config.PAYMENT_METHODS.CARD_TEB,
      o.confirmation_email_status || 'pending'
    ),
    idempotent: true,
  };
};

app.post('/store/custom/orders', orderLimiter, async (req, res) => {
  const input = validateOrderInput(req.body);
  const idempotencyKey =
    typeof req.headers['idempotency-key'] === 'string' && req.headers['idempotency-key'].trim()
      ? req.headers['idempotency-key'].trim().slice(0, 100)
      : null;
  const fingerprint = orderFingerprint(input);

  // Idempotent replay: same key -> return the same order, no new writes.
  // Same key + DIFFERENT payload -> reject (409), never return the wrong order.
  if (idempotencyKey) {
    const existing = await query(`SELECT * FROM orders WHERE idempotency_key = $1`, [idempotencyKey]);
    if (existing.rows[0]) {
      const o = existing.rows[0];
      if (o.idempotency_fingerprint && o.idempotency_fingerprint !== fingerprint) {
        throw new AppError(
          'idempotency_key_conflict',
          'This request key was already used with different order details.',
          409
        );
      }
      return res.status(200).json(existingOrderResponse(o));
    }
  }

  let result;
  try {
    result = await createOrderTransaction(input, idempotencyKey, fingerprint);
  } catch (error) {
    // Concurrent duplicate: the unique idempotency index rejected the 2nd insert.
    if (error && error.code === '23505' && idempotencyKey) {
      const race = await query(`SELECT * FROM orders WHERE idempotency_key = $1`, [idempotencyKey]);
      if (race.rows[0]) return res.status(200).json(existingOrderResponse(race.rows[0]));
    }
    throw error;
  }

  const requiresPayment = input.paymentMethod === config.PAYMENT_METHODS.CARD_TEB;

  // Transactional confirmation email. The order is already committed — a mail
  // failure must never change the customer's result. Never throws here.
  let emailStatus = 'pending';
  try {
    const r = await sendOrderConfirmationForOrder(result.order.id, { trigger: 'order_created' });
    emailStatus = r.status;
  } catch (err) {
    emailStatus = 'failed';
    console.warn('[order] confirmation email unexpected error', { order: orderNumber(result.order.id) });
  }

  res.status(201).json(publicOrderResponse(result.order, result.totals, requiresPayment, emailStatus));
});

function createOrderTransaction(input, idempotencyKey, fingerprint) {
  return withTransaction(async (client) => {
    // Load + lock every referenced product.
    const ids = [...new Set(input.items.map((i) => i.productId))];
    const productRows = await client.query(
      `SELECT id, title, price_cents, status, stock, track_inventory, sizes
         FROM products WHERE id = ANY($1::int[]) FOR UPDATE`,
      [ids]
    );
    const productsById = new Map(productRows.rows.map((r) => [r.id, r]));

    // Authoritative pricing (throws AppError on any product/size problem).
    const totals = computeOrderTotals({
      validatedItems: input.items,
      productsById,
      country: input.country,
    });

    // Stock integrity for inventory-tracked products only.
    const wanted = new Map();
    for (const it of input.items) {
      wanted.set(it.productId, (wanted.get(it.productId) || 0) + it.quantity);
    }
    for (const [pid, qty] of wanted) {
      const product = productsById.get(pid);
      if (product.track_inventory) {
        if (Number(product.stock) < qty) {
          throw new AppError(
            'insufficient_stock',
            `"${product.title}" does not have enough stock for that quantity.`,
            409
          );
        }
      }
    }

    // Create the order.
    const orderInsert = await client.query(
      `INSERT INTO orders
         (customer_name, customer_email, phone, payment_method, payment_status,
          shipping_address, country, shipping_method,
          subtotal_cents, shipping_cents, discount_cents, tax_cents, total_cents,
          currency, client_total_cents, idempotency_key, idempotency_fingerprint)
       VALUES ($1,$2,$3,$4,'unpaid',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        input.customerName,
        input.customerEmail,
        input.phone,
        input.paymentMethod,
        input.shippingAddress,
        input.country,
        input.shippingMethod,
        totals.subtotalCents,
        totals.shippingCents,
        totals.discountCents,
        totals.taxCents,
        totals.totalCents,
        totals.currency,
        input.clientTotalCents,
        idempotencyKey,
        idempotencyKey ? fingerprint : null,
      ]
    );
    const order = orderInsert.rows[0];

    // Line items priced from the DB.
    for (const line of totals.lines) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, size, quantity, price_cents)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, line.productId, line.name, line.size, line.quantity, line.unitPriceCents]
      );
    }

    // Decrement inventory-tracked stock in the same transaction.
    for (const [pid, qty] of wanted) {
      const product = productsById.get(pid);
      if (product.track_inventory) {
        await client.query(`UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2`, [
          qty,
          pid,
        ]);
      }
    }

    // Create the initial (unpaid) payment record — order != payment.
    await payments.createInitialPayment(client, {
      orderId: order.id,
      method: input.paymentMethod,
      amountCents: totals.totalCents,
      currency: totals.currency,
    });

    // Informational: log if the client's total disagreed with the server's.
    if (input.clientTotalCents !== null && input.clientTotalCents !== totals.totalCents) {
      console.warn('[order] client/server total mismatch', {
        orderId: order.id,
        clientTotalCents: input.clientTotalCents,
        serverTotalCents: totals.totalCents,
      });
    }

    return { order, totals };
  });
}

// ===========================================================================
// PAYMENTS — PREPARED architecture. Real TEB provider is a blocked stub.
// ===========================================================================

// Begin an online payment. Amount is ALWAYS the server order total.
app.post('/store/custom/payments/initiate', paymentLimiter, async (req, res) => {
  const orderId = Number(req.body?.orderId);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new AppError('invalid_input', 'A valid orderId is required.', 400);
  }
  const idempotencyKey =
    typeof req.headers['idempotency-key'] === 'string' && req.headers['idempotency-key'].trim()
      ? req.headers['idempotency-key'].trim().slice(0, 100)
      : null;

  const result = await payments.initiatePayment({ orderId, idempotencyKey });
  res.status(result.idempotent ? 200 : 201).json(result);
});

// Provider server-to-server callback. NOT a browser redirect target.
app.post('/store/custom/payments/:provider/callback', paymentLimiter, async (req, res) => {
  const providerName = String(req.params.provider || '').toLowerCase();

  let providerModule;
  if (providerName === 'mock') {
    if (!config.PAYMENTS_ALLOW_MOCK) throw new AppError('mock_disabled', 'Mock payments are disabled.', 403);
    providerModule = require('./payments/providers/mock');
  } else if (providerName === 'teb') {
    // TEB callback contract is unknown — do not guess.
    throw new AppError(
      'teb_not_configured',
      'TEB payment callbacks are not implemented yet.',
      501,
      { blocked: 'official TEB merchant API documentation and credentials required' }
    );
  } else {
    throw new AppError('unknown_provider', 'Unknown payment provider.', 404);
  }

  const verified = providerModule.verifyCallback({ body: req.body, headers: req.headers });
  const outcome = await payments.applyProviderResult(providerName, verified);
  res.json({ ok: true, status: outcome.payment.status, idempotent: Boolean(outcome.idempotent) });
});

// Read-only status for the customer "payment return" page. DB is source of truth.
app.get('/store/custom/payments/:paymentId/status', paymentLimiter, async (req, res) => {
  const paymentId = Number(req.params.paymentId);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    throw new AppError('invalid_input', 'Invalid payment id.', 400);
  }
  const row = await payments.getPaymentStatus(paymentId);
  // Minimal disclosure: enough for a return page to poll, without exposing
  // order amounts/ids for arbitrary (enumerable) payment ids. A signed return
  // token is the proper control and will be added with the real provider flow.
  res.json({
    paymentId: row.id,
    status: row.status,
    orderPaymentStatus: row.order_payment_status,
  });
});

// (Admin order routes now live in server/admin/router.js)

// ---------------------------------------------------------------------------
// 404 + centralised error handler (no stack traces / SQL / secrets leak).
// ---------------------------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Boot + graceful shutdown
// ---------------------------------------------------------------------------
let httpServer = null;

function shutdown(signal, code = 0) {
  console.log(`[shutdown] ${signal} — draining connections`);
  const done = () => {
    pool.end().catch(() => {}).finally(() => process.exit(code));
  };
  if (httpServer) httpServer.close(done);
  else done();
  // Hard cap so a stuck connection can't block the deploy forever.
  setTimeout(() => process.exit(code || 1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.message : String(reason));
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err && err.message);
  shutdown('uncaughtException', 1);
});

if (require.main === module) {
  initDatabase()
    .then(() => {
      // Fail closed at boot: if STORAGE_DRIVER=s3 is misconfigured this throws
      // here rather than letting the API come up "healthy" while uploads would
      // be written to Render's ephemeral disk.
      const storage = getStorage();
      console.log(`[storage] media driver: ${storage.driver}`);
      // Fail closed: EMAIL_PROVIDER=resend with no RESEND_API_KEY throws here.
      const email = getEmailService();
      console.log(`[email] ${email.enabled ? `enabled (provider: ${email.providerName})` : 'disabled'}`);
      httpServer = app.listen(config.PORT, () =>
        console.log(`BUKUR API running on http://localhost:${config.PORT} (${config.NODE_ENV})`)
      );
    })
    .catch((error) => {
      console.error('Startup failed:', error.message);
      process.exit(1);
    });
}

module.exports = { app, pool };
