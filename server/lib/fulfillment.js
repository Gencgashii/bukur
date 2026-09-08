'use strict';

const { AppError } = require('./errors');

/**
 * Fulfillment lifecycle. Defined server-side; the admin UI cannot invent a
 * transition. A cancelled order is terminal and cannot re-enter normal flow.
 */
const FULFILLMENT_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const FULFILLMENT_TRANSITIONS = Object.freeze({
  pending: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [], // terminal (returns/refunds are a separate concern)
  cancelled: [], // terminal
});

function assertFulfillmentTransition(from, to) {
  if (!FULFILLMENT_STATUSES.includes(to)) {
    throw new AppError('invalid_input', `Unknown fulfillment status "${to}".`, 400);
  }
  if (from === to) return; // no-op is allowed
  if (!(FULFILLMENT_TRANSITIONS[from] || []).includes(to)) {
    throw new AppError(
      'invalid_transition',
      `Cannot move fulfillment from "${from}" to "${to}".`,
      409
    );
  }
}

module.exports = { FULFILLMENT_STATUSES, FULFILLMENT_TRANSITIONS, assertFulfillmentTransition };
