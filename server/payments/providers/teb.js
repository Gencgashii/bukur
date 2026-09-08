'use strict';

const { AppError } = require('../../lib/errors');

/**
 * TEB Kosovo e-commerce payment gateway provider — STUB.
 *
 * ============================================================================
 * TEB PROVIDER INTEGRATION BLOCKED — OFFICIAL MERCHANT API DOCUMENTATION /
 * CREDENTIALS REQUIRED.
 * ============================================================================
 *
 * Nothing about TEB's real integration is implemented here because none of the
 * following is known from official TEB documentation:
 *   - API base URL and endpoint paths
 *   - merchant id / terminal id format
 *   - authentication scheme and secret/signature algorithm
 *   - request field names, response field names
 *   - hosted-page vs direct-post redirect flow
 *   - server-to-server callback / webhook contract
 *   - transaction status values and their mapping
 *   - currency, refund and void behaviour
 *
 * This module intentionally throws so the rest of the system can be built and
 * tested against the provider ABSTRACTION (see ../index.js and ./mock.js)
 * without guessing TEB's contract. Do not fill this in from assumptions.
 */

const NOT_CONFIGURED = () => {
  throw new AppError(
    'teb_not_configured',
    'Online card payment is not available yet.',
    501,
    { provider: 'teb', blocked: 'official TEB merchant API documentation and credentials required' }
  );
};

module.exports = {
  id: 'teb',
  displayName: 'TEB Kosovo',
  requiresRedirect: true, // assumed to be a hosted/redirect page; confirm with TEB docs
  // Given an order + payment row, start a payment and return redirect details.
  initiate: NOT_CONFIGURED,
  // Verify a customer browser return (NOT proof of payment on its own).
  parseReturn: NOT_CONFIGURED,
  // Verify a server-to-server callback / webhook and return a normalised result.
  verifyCallback: NOT_CONFIGURED,
  // Query authoritative transaction status from TEB.
  fetchStatus: NOT_CONFIGURED,
  // Refund / void.
  refund: NOT_CONFIGURED,
};
