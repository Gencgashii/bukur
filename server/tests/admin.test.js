'use strict';

/**
 * Pure unit tests for the Admin Dashboard building blocks (no DB, no network).
 * Run:  node --test server/tests/admin.test.js
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-used-for-anything-real-0123456789';
process.env.NODE_ENV = 'test';
process.env.SHIPPING_RATES = 'XK:180,AL:480';

const test = require('node:test');
const assert = require('node:assert/strict');

const { assertFulfillmentTransition, FULFILLMENT_STATUSES } = require('../lib/fulfillment');
const { parseCookies, safeEqual } = require('../lib/cookies');
const { serializeProduct, serializeOrder, orderNumber, slugify } = require('../lib/serializers');

test('fulfillment: linear progression is allowed', () => {
  assert.doesNotThrow(() => assertFulfillmentTransition('pending', 'processing'));
  assert.doesNotThrow(() => assertFulfillmentTransition('processing', 'shipped'));
  assert.doesNotThrow(() => assertFulfillmentTransition('shipped', 'delivered'));
  assert.doesNotThrow(() => assertFulfillmentTransition('pending', 'pending')); // no-op ok
});

test('fulfillment: skipping is allowed only where the map permits', () => {
  assert.doesNotThrow(() => assertFulfillmentTransition('pending', 'shipped'));
  assert.throws(() => assertFulfillmentTransition('pending', 'delivered'), /invalid_transition|Cannot move/);
});

test('fulfillment: cancelled and delivered are terminal', () => {
  assert.throws(() => assertFulfillmentTransition('cancelled', 'processing'), /Cannot move/);
  assert.throws(() => assertFulfillmentTransition('delivered', 'shipped'), /Cannot move/);
});

test('fulfillment: unknown status rejected', () => {
  assert.throws(() => assertFulfillmentTransition('pending', 'teleported'), /Unknown fulfillment/);
  assert.deepEqual(FULFILLMENT_STATUSES, ['pending', 'processing', 'shipped', 'delivered', 'cancelled']);
});

test('cookies: parse a header into an object', () => {
  const c = parseCookies('bukur_admin=abc.def.ghi; bukur_csrf=deadbeef; other=1');
  assert.equal(c.bukur_admin, 'abc.def.ghi');
  assert.equal(c.bukur_csrf, 'deadbeef');
  assert.equal(c.other, '1');
  assert.deepEqual(parseCookies(''), {});
  assert.deepEqual(parseCookies(undefined), {});
});

test('cookies: safeEqual is length-safe and value-correct', () => {
  assert.equal(safeEqual('abcdef', 'abcdef'), true);
  assert.equal(safeEqual('abcdef', 'abcdeg'), false);
  assert.equal(safeEqual('abc', 'abcdef'), false);
  assert.equal(safeEqual('', ''), false); // empty never matches
});

test('serializeProduct: exposes CMS fields and derives primary image + lowStock', () => {
  const row = {
    id: 7, title: 'Aurelia', handle: 'aurelia', sku: 'AU-1', description: 'x',
    status: 'published', archived: false, featured: true, new_arrival: false,
    price_cents: 18900, stock: 2, track_inventory: true, low_stock_threshold: 3,
    sizes: ['38', '39'], images: [{ url: 'b.jpg', position: 1 }, { url: 'a.jpg', position: 0 }],
    image_url: 'legacy.jpg', category_id: 2, category_name: 'Pumps',
    updated_at: 'now', created_at: 'then',
  };
  const s = serializeProduct(row);
  assert.equal(s.sku, 'AU-1');
  assert.equal(s.featured, true);
  assert.equal(s.active, true);
  assert.equal(s.lowStock, true); // tracked & stock(2) <= threshold(3)
  assert.equal(s.thumbnail, 'a.jpg'); // position 0 wins
  assert.deepEqual(s.sizes, ['38', '39']);
  assert.equal(s.category.name, 'Pumps');
  assert.equal(s.priceCents, 18900);
});

test('serializeProduct: archived => not active; falls back to image_url', () => {
  const s = serializeProduct({
    id: 1, title: 'X', status: 'published', archived: true, price_cents: 100,
    stock: 0, track_inventory: false, sizes: [], images: [], image_url: 'only.jpg',
  });
  assert.equal(s.active, false);
  assert.equal(s.thumbnail, 'only.jpg');
  assert.equal(s.lowStock, false); // not tracked
});

test('serializeOrder: shapes items with per-line subtotal and never leaks raw columns as money', () => {
  const o = {
    id: 42, created_at: 'c', updated_at: 'u', customer_name: 'A', customer_email: 'a@b.co',
    phone: '049', shipping_address: { city: 'Prishtina' }, country: 'XK', shipping_method: 'standard',
    payment_method: 'bank_transfer', payment_status: 'unpaid', fulfillment_status: 'pending',
    currency: 'eur', subtotal_cents: 29000, shipping_cents: 180, discount_cents: 0, tax_cents: 0,
    total_cents: 29180, client_total_cents: 1,
  };
  const items = [{ id: 1, product_id: 5, name: 'Heel', size: '38', quantity: 2, price_cents: 14500 }];
  const s = serializeOrder(o, items, []);
  assert.equal(s.number, 'BK-000042');
  assert.equal(s.items[0].subtotalCents, 29000);
  assert.equal(s.totals.totalCents, 29180);
  assert.equal(s.customer.email, 'a@b.co');
});

test('orderNumber / slugify', () => {
  assert.equal(orderNumber(5), 'BK-000005');
  assert.equal(slugify('  Aurelia  Pump!! '), 'aurelia-pump');
});
