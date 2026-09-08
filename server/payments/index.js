'use strict';

/**
 * Payment service — the boundary between BUKUR's order flow and any payment
 * provider. TEB-specific logic lives ONLY in ./providers/teb.js (currently a
 * blocked stub). This module knows about:
 *   - the payment state machine
 *   - order <-> payment <-> provider-reference association
 *   - amount integrity (amount always comes from the server order total)
 *   - idempotency / duplicate-callback protection
 *
 * It never sets an order to "paid" from client input — only from a provider
 * result that has been verified by the provider module, or from an explicit
 * authenticated admin action for offline methods.
 */

const { withTransaction, query } = require('../db');
const { AppError } = require('../lib/errors');
const config = require('../config');
const tebProvider = require('./providers/teb');
const mockProvider = require('./providers/mock');
const { PAYMENT_STATUS, TERMINAL, ALLOWED_TRANSITIONS, canTransition } = require('./state');

/** Which provider implementation handles a given payment method. */
function providerForMethod(method) {
  if (method === config.PAYMENT_METHODS.CARD_TEB) {
    const impl = (process.env.PAYMENTS_CARD_PROVIDER || 'teb').toLowerCase();
    if (impl === 'mock') {
      if (!config.PAYMENTS_ALLOW_MOCK) {
        throw new AppError('mock_disabled', 'Mock payments are disabled in this environment.', 403);
      }
      return mockProvider;
    }
    return tebProvider; // real online card payments
  }
  // bank_transfer / cash_on_delivery: no external provider, settled by admin.
  return null;
}

function providerIdForMethod(method) {
  const p = providerForMethod(method);
  return p ? p.id : 'offline';
}

/**
 * Create the initial payment row for a freshly created order.
 * Always 'unpaid'. Amount is the authoritative server order total.
 * Runs on the caller's transaction client.
 */
async function createInitialPayment(client, { orderId, method, amountCents, currency }) {
  const provider = providerIdForMethod(method);
  const res = await client.query(
    `INSERT INTO payments (order_id, provider, method, status, amount_cents, currency)
     VALUES ($1, $2, $3, 'unpaid', $4, $5)
     RETURNING *`,
    [orderId, provider, method, amountCents, currency]
  );
  return res.rows[0];
}

async function loadOrderForUpdate(client, orderId) {
  const res = await client.query(
    `SELECT id, total_cents, currency, payment_method, payment_status
       FROM orders WHERE id = $1 FOR UPDATE`,
    [orderId]
  );
  if (!res.rows[0]) throw new AppError('order_not_found', 'Order not found.', 404);
  return res.rows[0];
}

/**
 * Begin an online payment for an order.
 * - amount is taken from orders.total_cents (never from the client)
 * - idempotent on `idempotencyKey`
 * - returns provider redirect instructions
 */
async function initiatePayment({ orderId, idempotencyKey }) {
  return withTransaction(async (client) => {
    const order = await loadOrderForUpdate(client, orderId);

    if (order.payment_status === PAYMENT_STATUS.PAID) {
      throw new AppError('already_paid', 'This order is already paid.', 409);
    }

    const provider = providerForMethod(order.payment_method);
    if (!provider) {
      throw new AppError(
        'not_online_payment',
        'This order does not use online card payment.',
        400
      );
    }

    // Idempotent replay. A key reused for a DIFFERENT order is a conflict.
    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT * FROM payments WHERE idempotency_key = $1 FOR UPDATE`,
        [idempotencyKey]
      );
      if (existing.rows[0]) {
        const p = existing.rows[0];
        if (Number(p.order_id) !== Number(orderId)) {
          throw new AppError(
            'idempotency_key_conflict',
            'This idempotency key was already used for a different order.',
            409
          );
        }
        return {
          idempotent: true,
          paymentId: p.id,
          status: p.status,
          amountCents: p.amount_cents,
          providerReference: p.provider_reference,
        };
      }
    }

    // Reuse an in-flight pending attempt for this order if one exists.
    const inflight = await client.query(
      `SELECT * FROM payments
        WHERE order_id = $1 AND provider = $2 AND status IN ('unpaid','pending')
        ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [orderId, provider.id]
    );

    let payment = inflight.rows[0];
    if (!payment) {
      const inserted = await client.query(
        `INSERT INTO payments (order_id, provider, method, status, amount_cents, currency, idempotency_key)
         VALUES ($1, $2, $3, 'pending', $4, $5, $6) RETURNING *`,
        [orderId, provider.id, order.payment_method, order.total_cents, order.currency, idempotencyKey || null]
      );
      payment = inserted.rows[0];
    } else if (idempotencyKey && !payment.idempotency_key) {
      await client.query(`UPDATE payments SET idempotency_key = $1 WHERE id = $2`, [
        idempotencyKey,
        payment.id,
      ]);
    }

    // Amount integrity: the amount we ask the provider for IS the order total.
    const amountCents = order.total_cents;

    const started = provider.initiate({ payment, order });

    await client.query(
      `UPDATE payments
          SET provider_reference = $1, status = 'pending', amount_cents = $2, updated_at = NOW()
        WHERE id = $3`,
      [started.providerReference || '', amountCents, payment.id]
    );
    // Move the order to 'pending' unless it is already settled. Allows a retry
    // after a previous 'failed'/'cancelled' attempt without ever touching a
    // 'paid' order.
    await client.query(
      `UPDATE orders SET payment_status = 'pending', updated_at = NOW()
        WHERE id = $1 AND payment_status <> 'paid'`,
      [orderId]
    );

    return {
      idempotent: false,
      paymentId: payment.id,
      status: PAYMENT_STATUS.PENDING,
      amountCents,
      providerReference: started.providerReference || '',
      requiresRedirect: Boolean(started.requiresRedirect),
      redirectUrl: started.redirectUrl || null,
    };
  });
}

/**
 * Apply a verified provider result (from a server-to-server callback).
 * Idempotent: a repeated callback for an already-final payment is a no-op.
 * Enforces amount integrity against BOTH the payment row and the order total.
 */
async function applyProviderResult(providerId, result) {
  const { providerReference, paymentId, amountCents, currency, status } = result;
  if (!TERMINAL.has(status) && status !== PAYMENT_STATUS.PENDING) {
    throw new AppError('invalid_status', 'Unsupported payment status.', 400);
  }
  // Amount must be a concrete non-negative integer (cents).
  if (!Number.isInteger(Number(amountCents)) || Number(amountCents) < 0) {
    throw new AppError('invalid_amount', 'Payment amount is invalid.', 400);
  }

  return withTransaction(async (client) => {
    // Match strictly within the callback's provider. Prefer the provider
    // transaction reference; fall back to the payment id ONLY when no reference
    // was supplied — and still scoped to this provider.
    let found;
    if (providerReference) {
      found = await client.query(
        `SELECT * FROM payments WHERE provider = $1 AND provider_reference = $2 FOR UPDATE`,
        [providerId, providerReference]
      );
    } else if (paymentId) {
      found = await client.query(
        `SELECT * FROM payments WHERE provider = $1 AND id = $2 FOR UPDATE`,
        [providerId, paymentId]
      );
    } else {
      throw new AppError('invalid_callback', 'Callback is missing a payment reference.', 400);
    }
    const payment = found.rows[0];
    if (!payment) throw new AppError('payment_not_found', 'Payment not found.', 404);

    // Currency must match the payment record when the provider reports one.
    if (currency && String(currency).toLowerCase() !== String(payment.currency).toLowerCase()) {
      throw new AppError('currency_mismatch', 'Payment currency did not match the order.', 409);
    }

    // Duplicate callback for an already-final payment -> safe no-op.
    if (TERMINAL.has(payment.status)) {
      if (payment.status === status) return { idempotent: true, payment };
      throw new AppError('payment_finalized', 'This payment can no longer change state.', 409);
    }

    const order = await loadOrderForUpdate(client, payment.order_id);

    // Amount integrity — the provider must confirm exactly the order total.
    if (
      Number(amountCents) !== Number(payment.amount_cents) ||
      Number(payment.amount_cents) !== Number(order.total_cents)
    ) {
      console.error('[payment] amount mismatch', {
        paymentId: payment.id,
        orderId: order.id,
        providerAmount: amountCents,
        paymentAmount: payment.amount_cents,
        orderTotal: order.total_cents,
      });
      // Record the failure, do not mark paid.
      await client.query(
        `UPDATE payments SET status = 'failed', error_code = 'amount_mismatch', updated_at = NOW() WHERE id = $1`,
        [payment.id]
      );
      await client.query(
        `UPDATE orders SET payment_status = 'failed', updated_at = NOW() WHERE id = $1`,
        [order.id]
      );
      throw new AppError('amount_mismatch', 'Payment amount did not match the order.', 409);
    }

    if (!canTransition(payment.status, status)) {
      throw new AppError('invalid_transition', `Cannot move payment from ${payment.status} to ${status}.`, 409);
    }

    const updated = await client.query(
      `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, payment.id]
    );
    await client.query(
      `UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2`,
      [status, order.id]
    );

    return { idempotent: false, payment: updated.rows[0] };
  });
}

/** Read-only status lookup for the customer "return" page. DB is the source of truth. */
async function getPaymentStatus(paymentId) {
  const res = await query(
    `SELECT p.id, p.status, p.amount_cents, p.currency, p.order_id, o.payment_status AS order_payment_status
       FROM payments p JOIN orders o ON o.id = p.order_id
      WHERE p.id = $1`,
    [paymentId]
  );
  if (!res.rows[0]) throw new AppError('payment_not_found', 'Payment not found.', 404);
  return res.rows[0];
}

/**
 * Explicit, authenticated admin settlement for offline methods (bank transfer,
 * COD). Still bound by the payment state machine: e.g. a 'paid' payment can
 * only move to 'refunded', never back to 'unpaid'/'pending'.
 */
async function adminSetPaymentOutcome({ orderId, status }) {
  const allowed = [PAYMENT_STATUS.PAID, PAYMENT_STATUS.CANCELLED, PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.UNPAID];
  if (!allowed.includes(status)) {
    throw new AppError('invalid_status', 'Unsupported payment status.', 400);
  }
  return withTransaction(async (client) => {
    const order = await loadOrderForUpdate(client, orderId);
    const latest = await client.query(
      `SELECT * FROM payments WHERE order_id = $1 ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [orderId]
    );
    let payment = latest.rows[0];
    if (!payment) {
      const inserted = await client.query(
        `INSERT INTO payments (order_id, provider, method, status, amount_cents, currency)
         VALUES ($1, 'offline', $2, 'unpaid', $3, $4) RETURNING *`,
        [orderId, order.payment_method, order.total_cents, order.currency]
      );
      payment = inserted.rows[0];
    }

    if (payment.status === status) {
      return { orderId, status, unchanged: true };
    }
    if (!canTransition(payment.status, status)) {
      throw new AppError(
        'invalid_transition',
        `Cannot move payment from ${payment.status} to ${status}.`,
        409
      );
    }

    await client.query(`UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2`, [
      status,
      payment.id,
    ]);
    await client.query(`UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2`, [
      status,
      orderId,
    ]);
    return { orderId, status };
  });
}

module.exports = {
  PAYMENT_STATUS,
  ALLOWED_TRANSITIONS,
  canTransition,
  providerForMethod,
  providerIdForMethod,
  createInitialPayment,
  initiatePayment,
  applyProviderResult,
  getPaymentStatus,
  adminSetPaymentOutcome,
};
