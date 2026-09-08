'use strict';

const crypto = require('crypto');
const { AppError } = require('../../lib/errors');
const { PAYMENTS_ALLOW_MOCK, PAYMENTS_MOCK_SECRET } = require('../../config');

/**
 * MOCK payment provider — DEVELOPMENT / TEST ONLY.
 *
 * This exists purely to exercise the payment ABSTRACTION and state machine
 * (pending -> paid / failed / cancelled, duplicate callbacks, amount checks)
 * before the real TEB integration is available.
 *
 * It is hard-disabled when NODE_ENV === 'production' (see config.js:
 * PAYMENTS_ALLOW_MOCK is forced false in prod). A "mock" success NEVER means
 * TEB is integrated.
 */

function assertEnabled() {
  if (!PAYMENTS_ALLOW_MOCK) {
    throw new AppError('mock_disabled', 'Mock payments are disabled in this environment.', 403);
  }
}

function sign(fields) {
  return crypto
    .createHmac('sha256', PAYMENTS_MOCK_SECRET)
    .update(fields.join('|'))
    .digest('hex');
}

module.exports = {
  id: 'mock',
  displayName: 'Mock (dev only)',
  requiresRedirect: true,

  // Start a payment: return a fake hosted-page URL the dev UI can POST back from.
  initiate({ payment, order }) {
    assertEnabled();
    const providerReference = `MOCK-${crypto.randomUUID()}`;
    const amountCents = order.total_cents;
    const sig = sign([providerReference, String(payment.id), String(amountCents)]);
    return {
      providerReference,
      requiresRedirect: true,
      // A relative URL; in dev the mock "bank page" is simulated by the test/UI.
      redirectUrl:
        `/__mock-pay?ref=${encodeURIComponent(providerReference)}` +
        `&pid=${payment.id}&amount=${amountCents}&sig=${sig}`,
    };
  },

  // Customer browser return — informational only; must still be verified.
  parseReturn(query) {
    assertEnabled();
    return {
      providerReference: String(query.ref || ''),
      declaredStatus: String(query.status || 'unknown'),
    };
  },

  // Server-to-server callback. Validates the HMAC and returns a normalised result.
  verifyCallback({ body }) {
    assertEnabled();
    const providerReference = String(body.ref || '');
    const paymentId = String(body.pid || '');
    const amountCents = Number(body.amount);
    const status = String(body.status || '');
    const expected = sign([providerReference, paymentId, String(amountCents)]);
    if (!body.sig || body.sig !== expected) {
      throw new AppError('invalid_signature', 'Payment callback signature is invalid.', 400);
    }
    const map = { success: 'paid', failure: 'failed', cancel: 'cancelled' };
    if (!map[status]) {
      throw new AppError('invalid_status', 'Unknown payment status in callback.', 400);
    }
    return {
      providerReference,
      paymentId: Number(paymentId),
      amountCents,
      currency: body.currency ? String(body.currency) : undefined,
      status: map[status],
    };
  },
};
