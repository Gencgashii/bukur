'use strict';

/**
 * Payment state machine — pure, no I/O. Kept separate so it can be unit-tested
 * without a database and reused by the payment service.
 *
 * Guarantees encoded here:
 *   - a settled ('paid') payment can ONLY move to 'refunded' — never back to
 *     'unpaid' / 'pending' / 'failed'
 *   - 'refunded' is terminal
 *   - a failed/cancelled attempt may be retried ('pending') but cannot jump
 *     straight to 'paid'
 */

const PAYMENT_STATUS = Object.freeze({
  UNPAID: 'unpaid',
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
});

const TERMINAL = new Set([
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.FAILED,
  PAYMENT_STATUS.CANCELLED,
  PAYMENT_STATUS.REFUNDED,
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  unpaid: ['pending', 'paid', 'failed', 'cancelled'],
  pending: ['paid', 'failed', 'cancelled'],
  failed: ['pending'],
  cancelled: ['pending'],
  paid: ['refunded'],
  refunded: [],
});

function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

module.exports = { PAYMENT_STATUS, TERMINAL, ALLOWED_TRANSITIONS, canTransition };
