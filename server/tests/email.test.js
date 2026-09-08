'use strict';

/**
 * Unit tests for the transactional order-confirmation email system.
 * NO real email, NO network, NO DB. Run: node --test server/tests/email.test.js
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-used-for-anything-real-0123456789';
process.env.NODE_ENV = 'test';
// email on, in-process transport, so getEmailService() is exercisable
process.env.EMAIL_ENABLED = 'true';
process.env.EMAIL_PROVIDER = 'memory';
process.env.EMAIL_FROM = 'BUKUR WORLD <orders@bukur.test>';

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderOrderConfirmation, money } = require('../lib/email/render');
const {
  assertSafeRecipient,
  sanitizeHeaderText,
  sendWithRetry,
  getEmailService,
  _resetEmailServiceForTests,
} = require('../lib/email');
const { outbox, _clearOutbox } = require('../lib/email/providers/memory');

// --------------------------------------------------------------------------
// fixtures — shapes match the persisted DB rows
// --------------------------------------------------------------------------
const baseOrder = {
  id: 142,
  customer_name: 'Elira Krasniqi',
  customer_email: 'elira@example.com',
  phone: '+383 49 123 456',
  payment_method: 'cash_on_delivery',
  payment_status: 'unpaid',
  shipping_address: { line1: 'Rr. Nëna Terezë 12', city: 'Prishtina', postalCode: '10000', country: 'Kosovo' },
  country: 'XK',
  shipping_method: 'standard',
  subtotal_cents: 79000,
  shipping_cents: 180,
  discount_cents: 0,
  tax_cents: 0,
  total_cents: 79180,
  currency: 'eur',
  created_at: '2026-09-08T10:00:00.000Z',
};
const items = [
  { id: 1, name: 'Signature Bow Slingback', size: '38', quantity: 1, price_cents: 39500 },
  { id: 2, name: 'Veil Mesh Pump', size: '39', quantity: 1, price_cents: 39500 },
];

// --------------------------------------------------------------------------
// TEMPLATE — content
// --------------------------------------------------------------------------
test('template: renders every required field', () => {
  const { subject, html, text } = renderOrderConfirmation({ order: baseOrder, items });
  assert.match(subject, /BUKUR WORLD .* Order BK-000142 confirmed/);
  for (const needle of [
    'BK-000142',
    'Elira Krasniqi',
    'Signature Bow Slingback',
    'Veil Mesh Pump',
    'Size 38',
    'Size 39',
    '8 September 2026',
    'Prishtina',
    'Cash on delivery',
    'automated order confirmation',
  ]) {
    assert.ok(html.includes(needle), `HTML missing: ${needle}`);
    assert.ok(text.includes(needle) || needle === 'automated order confirmation', `TEXT missing: ${needle}`);
  }
  // money
  assert.ok(html.includes('€791.80'), 'HTML total');
  assert.ok(text.includes('€791.80'), 'TEXT total');
  assert.ok(html.includes('€1.80'), 'HTML shipping');
});

test('template: totals + currency are formatted from persisted order fields', () => {
  const { html, text } = renderOrderConfirmation({ order: baseOrder, items });
  assert.ok(html.includes('€790.00')); // subtotal
  assert.ok(text.includes('Subtotal: €790.00'));
  assert.ok(text.includes('Total: €791.80 (EUR)'));
});

test('template: discount + tax rows appear only when > 0', () => {
  const noExtras = renderOrderConfirmation({ order: baseOrder, items });
  assert.ok(!noExtras.text.includes('Discount:'));
  assert.ok(!noExtras.text.includes('Tax:'));

  const withExtras = renderOrderConfirmation({
    order: { ...baseOrder, discount_cents: 500, tax_cents: 1000, total_cents: 79680 },
    items,
  });
  assert.ok(withExtras.text.includes('Discount: -€5.00'));
  assert.ok(withExtras.text.includes('Tax: €10.00'));
  assert.ok(withExtras.html.includes('-€5.00'));
});

test('template: no undefined / null / NaN leaks into output', () => {
  const messy = renderOrderConfirmation({
    order: { ...baseOrder, phone: null, shipping_address: null, subtotal_cents: undefined },
    items: [{ name: 'X', size: null, quantity: null, price_cents: undefined }],
  });
  for (const bad of ['undefined', 'null', 'NaN', '€NaN']) {
    assert.ok(!messy.html.includes(bad), `HTML contains ${bad}`);
    assert.ok(!messy.text.includes(bad), `TEXT contains ${bad}`);
  }
});

test('template: HTML-escapes customer + product names (no XSS)', () => {
  const evil = renderOrderConfirmation({
    order: { ...baseOrder, customer_name: '<script>alert(1)</script>' },
    items: [{ name: '<img src=x onerror=alert(2)>', size: '"><b>', quantity: 1, price_cents: 100 }],
  });
  assert.ok(!evil.html.includes('<script>alert(1)'));
  assert.ok(!evil.html.includes('<img src=x onerror'));
  assert.ok(evil.html.includes('&lt;script&gt;'));
});

// --------------------------------------------------------------------------
// TEMPLATE — payment honesty
// --------------------------------------------------------------------------
test('template: cash on delivery — due on delivery, never "received"', () => {
  const { html, text } = renderOrderConfirmation({ order: baseOrder, items });
  assert.ok(text.includes('Payment is due in cash when your order arrives.'));
  assert.ok(!/payment (has been |)received/i.test(text));
  assert.ok(html.includes('Due on delivery'));
});

test('template: bank transfer unpaid — asks for transfer, shows bank block, no "received"', () => {
  const { html, text } = renderOrderConfirmation({
    order: { ...baseOrder, payment_method: 'bank_transfer' },
    items,
    bankTransfer: { holder: 'BUKUR SH.P.K.', iban: 'XK00 0000 0000 0000 0000', bank: 'Demo Bank', instructions: 'Ref = order number.' },
  });
  assert.ok(text.includes('Please complete the bank transfer'));
  assert.ok(text.includes('XK00 0000 0000 0000 0000'));
  assert.ok(text.includes('BK-000142 as the payment reference'));
  assert.ok(!/payment received/i.test(text));
  assert.ok(html.includes('Awaiting bank transfer'));
});

test('template: bank transfer PAID — confirms payment, hides bank block', () => {
  const { html, text } = renderOrderConfirmation({
    order: { ...baseOrder, payment_method: 'bank_transfer', payment_status: 'paid' },
    items,
    bankTransfer: { iban: 'XK00 0000 0000 0000 0000' },
  });
  assert.ok(/payment/i.test(text) && text.includes('received'));
  assert.ok(!text.includes('XK00 0000 0000 0000 0000'));
  assert.ok(html.includes('Payment received'));
});

test('template: card order NOT paid — "awaiting payment", never claims success', () => {
  const { text } = renderOrderConfirmation({
    order: { ...baseOrder, payment_method: 'card_teb', payment_status: 'unpaid' },
    items,
    payment: { status: 'pending' },
  });
  assert.ok(text.includes('Awaiting payment'));
  assert.ok(!/payment .*received/i.test(text));
});

test('template: card order paid (payment row) — reflects confirmed payment', () => {
  const { text } = renderOrderConfirmation({
    order: { ...baseOrder, payment_method: 'card_teb', payment_status: 'unpaid' },
    items,
    payment: { status: 'paid' },
  });
  assert.ok(text.includes('received'));
});

test('template: contains no card / secret-shaped data', () => {
  const { html, text } = renderOrderConfirmation({ order: baseOrder, items });
  for (const forbidden of [/cvv/i, /card number/i, /\b\d{13,19}\b/, /sk_live/i, /Bearer /i, /password/i, /api[_-]?key/i]) {
    assert.doesNotMatch(html, forbidden);
    assert.doesNotMatch(text, forbidden);
  }
});

// --------------------------------------------------------------------------
// RECIPIENT / HEADER SAFETY
// --------------------------------------------------------------------------
test('assertSafeRecipient: accepts a normal address, l-cases it', () => {
  assert.equal(assertSafeRecipient('  Elira@Example.com '), 'elira@example.com');
});

test('assertSafeRecipient: rejects CRLF / header-injection / list attempts', () => {
  const bad = [
    'a@b.com\r\nBcc: evil@x.com',
    'a@b.com\nSubject: x',
    'a@b.com, c@d.com',
    'a@b.com;c@d.com',
    '"x" <a@b.com>',
    'a b@c.com',
    '',
    'not-an-email',
    `${'x'.repeat(200)}@y.com`,
  ];
  for (const v of bad) {
    assert.throws(() => assertSafeRecipient(v), (e) => e.code === 'invalid_recipient', `should reject ${JSON.stringify(v)}`);
  }
});

test('sanitizeHeaderText: strips CR/LF from a subject', () => {
  assert.equal(sanitizeHeaderText('Order\r\nBcc: x@y.com confirmed'), 'Order Bcc: x@y.com confirmed');
});

// --------------------------------------------------------------------------
// TRANSPORT + RETRY (fake provider, no network)
// --------------------------------------------------------------------------
const okProvider = () => ({ name: 'fake', calls: 0, async send() { this.calls += 1; return { ok: true, id: `x${this.calls}` }; } });
const failProvider = (category, times = Infinity) => ({
  name: 'fake',
  calls: 0,
  async send() {
    this.calls += 1;
    if (this.calls <= times) throw Object.assign(new Error(category), { category });
    return { ok: true, id: 'recovered' };
  },
});

test('retry: succeeds first try', async () => {
  const p = okProvider();
  const r = await sendWithRetry(p, { to: 'a@b.com', subject: 's', text: 't' });
  assert.equal(r.ok, true);
  assert.equal(p.calls, 1);
});

test('retry: transient provider_5xx twice then success (<= 3 attempts)', async () => {
  const p = failProvider('provider_5xx', 2);
  const r = await sendWithRetry(p, {});
  assert.equal(r.id, 'recovered');
  assert.equal(p.calls, 3);
});

test('retry: persistent 5xx -> email_send_failed, bounded at 3 attempts', async () => {
  const p = failProvider('provider_5xx');
  await assert.rejects(
    sendWithRetry(p, {}),
    (e) => e.code === 'email_send_failed' && e.details.category === 'provider_5xx' && e.status === 502
  );
  assert.equal(p.calls, 3);
});

test('retry: provider_4xx is NOT retried', async () => {
  const p = failProvider('provider_4xx');
  await assert.rejects(sendWithRetry(p, {}), (e) => e.details.category === 'provider_4xx');
  assert.equal(p.calls, 1);
});

test('retry: network + timeout are retried then surfaced by category', async () => {
  for (const cat of ['network', 'timeout']) {
    const p = failProvider(cat);
    await assert.rejects(sendWithRetry(p, {}), (e) => e.details.category === cat);
    assert.equal(p.calls, 3);
  }
});

test('retry: malformed provider response -> bad_response', async () => {
  const p = { name: 'fake', async send() { return { ok: true }; } }; // no id
  await assert.rejects(sendWithRetry(p, {}), (e) => e.details.category === 'bad_response');
});

// --------------------------------------------------------------------------
// EMAIL SERVICE (memory transport)
// --------------------------------------------------------------------------
test('getEmailService: enabled + memory provider sends, records outbox, no network', async () => {
  _clearOutbox();
  _resetEmailServiceForTests();
  const email = getEmailService();
  assert.equal(email.enabled, true);
  assert.equal(email.providerName, 'memory');

  const { subject, html, text } = renderOrderConfirmation({ order: baseOrder, items });
  const r = await email.send({ to: 'Elira@Example.com', subject, html, text });
  assert.equal(r.ok, true);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, 'elira@example.com'); // normalised
  assert.equal(outbox[0].from, 'BUKUR WORLD <orders@bukur.test>');
  assert.ok(outbox[0].html.includes('BK-000142'));
});

test('getEmailService: rejects an injection recipient before any send', async () => {
  _clearOutbox();
  _resetEmailServiceForTests();
  const email = getEmailService();
  await assert.rejects(
    email.send({ to: 'a@b.com\r\nBcc: evil@x.com', subject: 's', text: 't' }),
    (e) => e.code === 'invalid_recipient'
  );
  assert.equal(outbox.length, 0);
});

test('getEmailService: empty subject / empty body rejected', async () => {
  _resetEmailServiceForTests();
  const email = getEmailService();
  await assert.rejects(email.send({ to: 'a@b.com', subject: '  ', text: 't' }), (e) => e.details.category === 'bad_input');
  await assert.rejects(email.send({ to: 'a@b.com', subject: 's' }), (e) => e.details.category === 'bad_input');
});

test('getEmailService: a failing transport surfaces a safe category-only error (no internals)', async () => {
  _resetEmailServiceForTests();
  const email = getEmailService();
  email.__setProviderForTests(failProvider('provider_5xx'));
  await assert.rejects(email.send({ to: 'a@b.com', subject: 's', text: 't' }), (e) => {
    return (
      e.code === 'email_send_failed' &&
      e.details.category === 'provider_5xx' &&
      !/resend|api|key|bearer|http/i.test(e.message)
    );
  });
});

// --------------------------------------------------------------------------
// CONFIG — disabled / prod validation (isolated require)
// --------------------------------------------------------------------------
test('config: EMAIL_ENABLED=false -> send() is a no-op "skipped", transport never touched', () => {
  const bust = () => {
    for (const k of Object.keys(require.cache)) {
      if (k.includes(`${require('path').sep}server${require('path').sep}config.js`) || k.includes(`${require('path').sep}lib${require('path').sep}email${require('path').sep}`)) {
        delete require.cache[k];
      }
    }
  };
  const snap = { EMAIL_ENABLED: process.env.EMAIL_ENABLED };
  process.env.EMAIL_ENABLED = 'false';
  bust();
  try {
    const mod = require('../lib/email');
    const email = mod.getEmailService();
    assert.equal(email.enabled, false);
    return email.send({ to: 'a@b.com', subject: 's', text: 't' }).then((r) => {
      assert.equal(r.skipped, true);
      assert.equal(r.id, null);
    });
  } finally {
    process.env.EMAIL_ENABLED = snap.EMAIL_ENABLED;
    bust();
    require('../config');
    require('../lib/email');
  }
});

test('config: production + non-prod provider throws at load (fail obvious)', () => {
  const path = require('path');
  const bust = () => {
    for (const k of Object.keys(require.cache)) {
      if (k.includes(`${path.sep}server${path.sep}config.js`)) delete require.cache[k];
    }
  };
  const keys = ['NODE_ENV', 'EMAIL_ENABLED', 'EMAIL_PROVIDER', 'CLIENT_ORIGINS', 'JWT_SECRET'];
  const snap = {};
  for (const k of keys) snap[k] = process.env[k];
  process.env.NODE_ENV = 'production';
  process.env.EMAIL_ENABLED = 'true';
  process.env.EMAIL_PROVIDER = 'console';
  process.env.CLIENT_ORIGINS = 'https://bukur.example'; // get past the earlier prod gates
  process.env.JWT_SECRET = 'x'.repeat(40);
  bust();
  try {
    assert.throws(() => require('../config'), /cannot be used in production/);
  } finally {
    for (const k of keys) {
      if (snap[k] === undefined) delete process.env[k];
      else process.env[k] = snap[k];
    }
    bust();
    require('../config');
  }
});
