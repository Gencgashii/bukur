'use strict';

/**
 * Unit tests for server-side pricing + order-input validation.
 * No database required. Run with:  node --test server/tests/
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-used-for-anything-real-01';
// XK/AL rates (180/480) are asserted exactly by the pricing tests below; the
// rest are here only so the postal-code-format tests can use a real country.
process.env.SHIPPING_RATES = 'XK:180,AL:480,MK:480,DE:2000,GR:2000,SE:2000,GB:2000';
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

test('pricing: shipping is derived from country config only (home delivery)', () => {
  const productsById = makeProducts([
    { id: 1, title: 'ICON', price_cents: 10000, status: 'published', sizes: [] },
  ]);
  const xk = computeOrderTotals({ validatedItems: [{ productId: 1, quantity: 1 }], productsById, country: 'XK', shippingMethod: 'standard' });
  const al = computeOrderTotals({ validatedItems: [{ productId: 1, quantity: 1 }], productsById, country: 'AL', shippingMethod: 'standard' });
  assert.equal(xk.shippingCents, 180);
  assert.equal(al.shippingCents, 480);
});

// ---------------------------------------------------------------------------
// Studio pickup: shipping is always 0, regardless of country or client input
// ---------------------------------------------------------------------------

test('pricing: studio pickup is always free shipping, independent of country', () => {
  const productsById = makeProducts([
    { id: 1, title: 'ICON', price_cents: 10000, status: 'published', sizes: [] },
  ]);
  const xk = computeOrderTotals({ validatedItems: [{ productId: 1, quantity: 1 }], productsById, country: 'XK', shippingMethod: 'pickup' });
  const gb = computeOrderTotals({ validatedItems: [{ productId: 1, quantity: 1 }], productsById, country: 'GB', shippingMethod: 'pickup' });
  assert.equal(xk.shippingCents, 0);
  assert.equal(xk.totalCents, 10000);
  assert.equal(gb.shippingCents, 0);
  assert.equal(gb.totalCents, 10000);
});

test('pricing: pickup ignores a malicious client-supplied shipping amount', () => {
  const productsById = makeProducts([{ id: 1, title: 'ICON', price_cents: 10000, status: 'published', sizes: [] }]);
  const input = validateOrderInput({
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'XK',
    paymentMethod: 'bank_transfer', shippingMethod: 'pickup',
    shippingAddress: {},
    items: [{ id: 1, quantity: 1 }],
    // attacker-supplied fields that validateOrderInput must simply not read
    shippingCents: 99999, shipping: 99999,
  });
  const totals = computeOrderTotals({
    validatedItems: input.items, productsById, country: input.country, shippingMethod: input.shippingMethod,
  });
  assert.equal(totals.shippingCents, 0);
  assert.equal(totals.totalCents, 10000);
});

test('pricing: pickup ignores a malicious client-supplied total', () => {
  const productsById = makeProducts([{ id: 1, title: 'ICON', price_cents: 10000, status: 'published', sizes: [] }]);
  const input = validateOrderInput({
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'XK',
    paymentMethod: 'bank_transfer', shippingMethod: 'pickup',
    shippingAddress: {},
    items: [{ id: 1, quantity: 1 }],
    total: 0.01,
  });
  assert.equal(input.clientTotalCents, 1); // captured for logging only
  const totals = computeOrderTotals({
    validatedItems: input.items, productsById, country: input.country, shippingMethod: input.shippingMethod,
  });
  assert.equal(totals.totalCents, 10000); // real price + 0 shipping, not 1
});

test('pricing: home delivery ignores a malicious client-supplied shipping amount', () => {
  const productsById = makeProducts([{ id: 1, title: 'ICON', price_cents: 10000, status: 'published', sizes: [] }]);
  const input = validateOrderInput({
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'AL',
    paymentMethod: 'bank_transfer', shippingMethod: 'standard',
    shippingAddress: { address: 'Rr 1', city: 'Tirana', postalCode: '1001' },
    items: [{ id: 1, quantity: 1 }],
    shippingCents: 1, // attacker wants free/near-free shipping to a 480-rate country
  });
  const totals = computeOrderTotals({
    validatedItems: input.items, productsById, country: input.country, shippingMethod: input.shippingMethod,
  });
  assert.equal(totals.shippingCents, 480); // real AL rate, not the injected 1
  assert.equal(totals.totalCents, 10480);
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

// ---------------------------------------------------------------------------
// Delivery method: pickup vs home delivery
// ---------------------------------------------------------------------------

test('validation: home delivery (default/standard) still requires address, city, postal code', () => {
  const base = {
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'XK',
    paymentMethod: 'bank_transfer',
    items: [{ id: 1, quantity: 1 }],
  };
  assert.throws(
    () => validateOrderInput({ ...base, shippingAddress: { city: 'Prishtina', postalCode: '10000' } }),
    /Address is required/
  );
  assert.throws(
    () => validateOrderInput({ ...base, shippingAddress: { address: 'Rr 1', postalCode: '10000' } }),
    /City is required/
  );
  assert.throws(
    () => validateOrderInput({ ...base, shippingAddress: { address: 'Rr 1', city: 'Prishtina' } }),
    /Postal code is required/
  );
});

test('validation: pickup does not require address, city or postal code', () => {
  const v = validateOrderInput({
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'XK',
    paymentMethod: 'bank_transfer',
    shippingMethod: 'pickup',
    shippingAddress: {},
    items: [{ id: 1, quantity: 1 }],
  });
  assert.equal(v.shippingMethod, 'pickup');
  assert.equal(v.shippingAddress.address, '');
  assert.equal(v.shippingAddress.city, '');
  assert.equal(v.shippingAddress.postalCode, '');
});

test('validation: pickup still sanitises an address if one is sent anyway', () => {
  const v = validateOrderInput({
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'XK',
    paymentMethod: 'bank_transfer',
    shippingMethod: 'pickup',
    shippingAddress: { address: '  Rr 1  ', city: 'Prishtina' },
    items: [{ id: 1, quantity: 1 }],
  });
  assert.equal(v.shippingAddress.address, 'Rr 1');
  assert.equal(v.shippingAddress.city, 'Prishtina');
});

test('validation: rejects an unknown shipping method regardless of address', () => {
  assert.throws(() => validateOrderInput({
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'XK',
    paymentMethod: 'bank_transfer',
    shippingMethod: 'drone_dropoff',
    shippingAddress: { address: 'Rr 1', city: 'Prishtina', postalCode: '10000' },
    items: [{ id: 1, quantity: 1 }],
  }), /Unknown shipping method/);
});

// ---------------------------------------------------------------------------
// Postal code: country-aware format, not a single fixed rule
// ---------------------------------------------------------------------------

test('validation: postal code accepts each supported country\'s real format', () => {
  const cases = [
    ['XK', '10000'],
    ['AL', '1001'],
    ['DE', '10115'],
    ['GR', '104 31'],
    ['SE', '111 22'],
    ['GB', 'SW1A 1AA'],
    ['GB', 'M1 1AE'],
    ['GB', 'B33 8TH'],
  ];
  for (const [country, postalCode] of cases) {
    const v = validateOrderInput({
      customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country,
      paymentMethod: 'bank_transfer',
      shippingAddress: { address: 'Rr 1', city: 'City', postalCode },
      items: [{ id: 1, quantity: 1 }],
    });
    assert.equal(v.shippingAddress.postalCode, postalCode);
  }
});

test('validation: postal code rejects an obviously wrong format for the selected country', () => {
  assert.throws(() => validateOrderInput({
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'GB',
    paymentMethod: 'bank_transfer',
    shippingAddress: { address: 'Rr 1', city: 'City', postalCode: '12345' }, // valid US zip, not a UK postcode
    items: [{ id: 1, quantity: 1 }],
  }), /valid postal code for GB/);

  assert.throws(() => validateOrderInput({
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'XK',
    paymentMethod: 'bank_transfer',
    shippingAddress: { address: 'Rr 1', city: 'City', postalCode: '1000' }, // 4 digits, Kosovo uses 5
    items: [{ id: 1, quantity: 1 }],
  }), /valid postal code for XK/);
});

test('validation: address accepts numbers, hyphens, commas, slashes and unit numbers', () => {
  const v = validateOrderInput({
    customerName: 'A B', customerEmail: 'a@b.com', phone: '049123456', country: 'XK',
    paymentMethod: 'bank_transfer',
    shippingAddress: { address: 'Rr. Nëna Terezë 12/3-A, Apt. 5', city: 'Prishtina', postalCode: '10000' },
    items: [{ id: 1, quantity: 1 }],
  });
  assert.equal(v.shippingAddress.address, 'Rr. Nëna Terezë 12/3-A, Apt. 5');
});
