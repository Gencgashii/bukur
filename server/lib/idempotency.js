'use strict';

const crypto = require('crypto');

/**
 * Deterministic fingerprint of the meaningful parts of an order request.
 *
 * Used to enforce: "the same Idempotency-Key must not be reused with a
 * different payload." A replay with a matching fingerprint returns the original
 * order; a replay with a different fingerprint is rejected (409) rather than
 * silently returning the wrong order.
 *
 * Only fields that affect what is ordered / where it ships / how it is paid are
 * included, in a canonical (sorted, normalised) form.
 */
function orderFingerprint(input) {
  const canonical = {
    email: String(input.customerEmail || '').trim().toLowerCase(),
    country: String(input.country || '').trim().toUpperCase(),
    paymentMethod: String(input.paymentMethod || '').trim(),
    shippingMethod: String(input.shippingMethod || '').trim(),
    items: [...(input.items || [])]
      .map((i) => ({
        productId: Number(i.productId),
        size: String(i.size || ''),
        quantity: Number(i.quantity),
      }))
      .sort((a, b) =>
        a.productId - b.productId || a.size.localeCompare(b.size) || a.quantity - b.quantity
      ),
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

module.exports = { orderFingerprint };
