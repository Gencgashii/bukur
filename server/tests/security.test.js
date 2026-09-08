'use strict';

/**
 * Pure unit tests (no DB) for the audit-relevant building blocks:
 * payment state machine, order idempotency fingerprint, error classification.
 * Run:  node --test server/tests/security.test.js
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-used-for-anything-real-0123456789';
process.env.NODE_ENV = 'test';
process.env.SHIPPING_RATES = 'XK:180,AL:480';

const test = require('node:test');
const assert = require('node:assert/strict');

const { canTransition, ALLOWED_TRANSITIONS } = require('../payments/state');
const { orderFingerprint } = require('../lib/idempotency');

test('state machine: paid can only go to refunded', () => {
  assert.equal(canTransition('paid', 'refunded'), true);
  assert.equal(canTransition('paid', 'unpaid'), false);
  assert.equal(canTransition('paid', 'pending'), false);
  assert.equal(canTransition('paid', 'failed'), false);
});

test('state machine: refunded is terminal', () => {
  assert.deepEqual(ALLOWED_TRANSITIONS.refunded, []);
});

test('state machine: unpaid can be confirmed to paid (offline flow) or fail', () => {
  assert.equal(canTransition('unpaid', 'paid'), true);
  assert.equal(canTransition('unpaid', 'pending'), true);
  assert.equal(canTransition('unpaid', 'failed'), true);
});

test('state machine: failed/cancelled can be retried to pending only', () => {
  assert.equal(canTransition('failed', 'pending'), true);
  assert.equal(canTransition('failed', 'paid'), false);
  assert.equal(canTransition('cancelled', 'pending'), true);
  assert.equal(canTransition('cancelled', 'paid'), false);
});

test('idempotency fingerprint: identical carts (any order) match', () => {
  const a = orderFingerprint({
    customerEmail: 'A@Example.com', country: 'xk', paymentMethod: 'bank_transfer', shippingMethod: 'standard',
    items: [{ productId: 2, size: '38', quantity: 1 }, { productId: 1, size: '', quantity: 3 }],
  });
  const b = orderFingerprint({
    customerEmail: 'a@example.com', country: 'XK', paymentMethod: 'bank_transfer', shippingMethod: 'standard',
    items: [{ productId: 1, size: '', quantity: 3 }, { productId: 2, size: '38', quantity: 1 }],
  });
  assert.equal(a, b);
});

test('idempotency fingerprint: different quantity -> different fingerprint', () => {
  const a = orderFingerprint({
    customerEmail: 'a@b.com', country: 'XK', paymentMethod: 'bank_transfer', shippingMethod: 'standard',
    items: [{ productId: 1, size: '', quantity: 1 }],
  });
  const b = orderFingerprint({
    customerEmail: 'a@b.com', country: 'XK', paymentMethod: 'bank_transfer', shippingMethod: 'standard',
    items: [{ productId: 1, size: '', quantity: 2 }],
  });
  assert.notEqual(a, b);
});

test('idempotency fingerprint: different payment method -> different fingerprint', () => {
  const base = {
    customerEmail: 'a@b.com', country: 'XK', shippingMethod: 'standard',
    items: [{ productId: 1, size: '', quantity: 1 }],
  };
  assert.notEqual(
    orderFingerprint({ ...base, paymentMethod: 'bank_transfer' }),
    orderFingerprint({ ...base, paymentMethod: 'card_teb' })
  );
});

test('error classification: malformed JSON maps to 400, not 500', () => {
  const { errorHandler } = require('../lib/errors');
  const err = Object.assign(new SyntaxError('Unexpected token }'), {
    type: 'entity.parse.failed', status: 400, statusCode: 400, expose: true,
  });
  let sent = null;
  const res = { status(c) { this._c = c; return this; }, json(b) { sent = { code: this._c, body: b }; } };
  errorHandler(err, { method: 'POST', originalUrl: '/x' }, res, () => {});
  assert.equal(sent.code, 400);
  assert.equal(sent.body.error.code, 'invalid_json');
  assert.ok(!JSON.stringify(sent.body).includes('Unexpected token'));
});

test('error classification: payload too large maps to 413', () => {
  const { errorHandler } = require('../lib/errors');
  const err = Object.assign(new Error('request entity too large'), {
    type: 'entity.too.large', status: 413, statusCode: 413, expose: true,
  });
  let sent = null;
  const res = { status(c) { this._c = c; return this; }, json(b) { sent = { code: this._c, body: b }; } };
  errorHandler(err, { method: 'POST', originalUrl: '/x' }, res, () => {});
  assert.equal(sent.code, 413);
  assert.equal(sent.body.error.code, 'payload_too_large');
});

test('error classification: unknown error stays generic 500 with no leak', () => {
  const { errorHandler } = require('../lib/errors');
  const err = new Error('ECONNREFUSED 127.0.0.1:5432 select * from admins');
  let sent = null;
  const res = { status(c) { this._c = c; return this; }, json(b) { sent = { code: this._c, body: b }; } };
  errorHandler(err, { method: 'GET', originalUrl: '/x' }, res, () => {});
  assert.equal(sent.code, 500);
  assert.equal(sent.body.error.code, 'internal_error');
  assert.ok(!JSON.stringify(sent.body).includes('admins'));
  assert.ok(!JSON.stringify(sent.body).includes('5432'));
});
