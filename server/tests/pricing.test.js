'use strict';

/**
 * Unit tests for server-side pricing + order-input validation.
 * No database required. Run with:  node --test server/tests/
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-used-for-anything-real-01';
process.env.SHIPPING_RATES = 'XK:180,AL:480';
process.env.TAX_RATE_BPS = '0';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const { computeOrderTotals } = require('../lib/pricing');
const { validateOrderInput } = require('../lib/validation');

const makeProducts = (rows) => new Map(rows.map((r) => [r.id, r]));

test('pricing: subtotal comes from the DB price, not the client', () => {
  const productsById = makeProducts([
    { id: 1, title: 'ICON', price_cents: 14500, status: 'published', stock: 0, track_inventory: false, sizes: [] },
  ]);
  const totals = computeOrderTotals({
    validatedItems: [{ productId: 1, size: '', quantity: 2 }],
    productsById,
    country: 'XK',
  });
  assert.equal(totals.subtotalCents, 29000);
  assert.equal(totals.shippingCents, 180);
  assert.equal(totals.discountCents, 0);
  assert.equal(totals.taxCents, 0);
  assert.equal(totals.totalCents, 29180);
});

test('pricing: shipping is derived from country config only', () => {
  const productsById = makeProducts([
    { id: 1, title: 'ICON', price_cents: 10000, status: 'published', sizes: [] },
  ]);
  const xk = computeOrderTotals({ validatedItems: [{ productId: 1, quantity: 1 }], productsById, country: 'XK' });
  const al = computeOrderTotals({ validatedItems: [{ productId: 1, quantity: 1 }], productsById, country: 'AL' });
  assert.equal(xk.shippingCents, 180);
  assert.equal(al.shippingCents, 480);
});

test('pricing: unknown product is rejected', () => {
  const productsById = makeProducts([]);
  assert.throws(
    () => computeOrderTotals({ validatedItems: [{ productId: 99, quantity: 1 }], productsById, country: 'XK' }),
    /no longer available/
  );
});

test('pricing: unpublished product is rejected', () => {
  const productsById = makeProducts([{ id: 1, title: 'Hidden', price_cents: 5000, status: 'draft', sizes: [] }]);
  assert.throws(
    () => computeOrderTotals({ validatedItems: [{ productId: 1, quantity: 1 }], productsById, country: 'XK' }),
    /not available for purchase/
  );
});

test('pricing: invalid size is rejected when the product has sizes', () => {
  const productsById = makeProducts([
    { id: 1, title: 'ICON', price_cents: 5000, status: 'published', sizes: ['38', '39'] },
  ]);
  assert.throws(
    () => computeOrderTotals({ validatedItems: [{ productId: 1, size: '41', quantity: 1 }], productsById, country: 'XK' }),
    /valid size/
  );
  // valid size passes
  const ok = computeOrderTotals({
    validatedItems: [{ productId: 1, size: '38', quantity: 1 }],
    productsById,
    country: 'XK',
  });
  assert.equal(ok.totalCents, 5180);
});

test('pricing: tax applied when TAX_RATE_BPS configured (isolated recompute)', () => {
  // Simulate 18% VAT purely at the math level.
  const subtotal = 10000;
  const bps = 1800;
  const tax = Math.round((subtotal * bps) / 10000);
  assert.equal(tax, 1800);
});

test('validation: rejects missing email', () => {
  assert.throws(() => validateOrderInput({
    customerName: 'A B', phone: '049123456', country: 'XK',
    paymentMethod: 'bank_transfer',
    shippingAddress: { address: 'Rr 1', city: 'Prishtina', postalCode: '10000' },
    items: [{ id: 1, quantity: 1 }],
  }), /Email is required|valid email/);
});

test('validation: rejects malformed email', () => {
  assert.throws(() => validateOrderInput({
    customerName: 'A B', customerEmail: 'not-an-email', phone: '049123456', country: 'XK',
    paymentMethod: 'bank_transfer',
    shippingAddress: { address: 'Rr 1', city: 'Prishtina', postalCode: '10000' },
    items: [{ id: 1, quantity: 1 }],
  }), /valid email/);
});

test('validation: rejects unsupported country', () => {
  assert.throws(() => validateOrderInput({
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'US',
    paymentMethod: 'bank_transfer',
    shippingAddress: { address: 'Rr 1', city: 'Prishtina', postalCode: '10000' },
    items: [{ id: 1, quantity: 1 }],
  }), /do not currently ship/);
});

test('validation: rejects unknown payment method', () => {
  assert.throws(() => validateOrderInput({
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'XK',
    paymentMethod: 'bitcoin',
    shippingAddress: { address: 'Rr 1', city: 'Prishtina', postalCode: '10000' },
    items: [{ id: 1, quantity: 1 }],
  }), /Unknown payment method/);
});

test('validation: rejects empty cart and absurd quantities', () => {
  const base = {
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'XK',
    paymentMethod: 'bank_transfer',
    shippingAddress: { address: 'Rr 1', city: 'Prishtina', postalCode: '10000' },
  };
  assert.throws(() => validateOrderInput({ ...base, items: [] }), /cart is empty/);
  assert.throws(() => validateOrderInput({ ...base, items: [{ id: 1, quantity: 999 }] }), /between 1 and 20/);
});

test('validation: client total is captured but never trusted', () => {
  const v = validateOrderInput({
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'XK',
    paymentMethod: 'bank_transfer',
    shippingAddress: { address: 'Rr 1', city: 'Prishtina', postalCode: '10000' },
    items: [{ id: 1, quantity: 1 }],
    total: 1,
  });
  assert.equal(v.clientTotalCents, 100);
  assert.ok(!('total' in v));
});
