'use strict';

/**
 * Pure renderer for the BUKUR WORLD order-confirmation email.
 *
 * NO I/O, NO provider calls. Every value comes from persisted server-side order
 * data (the `orders` row, `order_items` rows, the latest `payments` row) plus
 * the store's own `contact` / `bank_transfer` settings. The caller is
 * responsible for passing trusted data; this module only formats + escapes it.
 *
 *   renderOrderConfirmation({ order, items, payment, contact, bankTransfer, storeUrl })
 *     -> { subject, html, text }
 *
 * The email never states that a payment was received unless the persisted
 * payment/order state says 'paid'.
 */

const BRAND = 'BUKUR WORLD';

const CURRENCY_SYMBOL = { eur: '€', usd: '$', gbp: '£' };

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(cents, currency) {
  const n = Number(cents);
  const safe = Number.isFinite(n) ? n : 0;
  const sym = CURRENCY_SYMBOL[String(currency || '').toLowerCase()] || '';
  const amount = (safe / 100).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return sym ? `${sym}${amount}` : `${amount} ${String(currency || '').toUpperCase()}`.trim();
}

function orderNumber(id) {
  return `BK-${String(id).padStart(6, '0')}`;
}

function formatDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Human-readable payment method + a status line that is honest about payment. */
function paymentPresentation(order, payment) {
  const method = String(order.payment_method || '');
  const orderPaid = String(order.payment_status || '') === 'paid';
  const paymentPaid = payment && String(payment.status || '') === 'paid';
  const isPaid = orderPaid || paymentPaid;

  const methodLabel =
    method === 'cash_on_delivery'
      ? 'Cash on delivery'
      : method === 'bank_transfer'
        ? 'Bank transfer'
        : method === 'card_teb'
          ? 'Card'
          : method || 'Not specified';

  let statusLabel;
  let nextSteps;
  if (method === 'cash_on_delivery') {
    statusLabel = 'Due on delivery';
    nextSteps = 'Your order will be prepared for delivery. Payment is due in cash when your order arrives.';
  } else if (method === 'bank_transfer') {
    statusLabel = isPaid ? 'Payment received' : 'Awaiting bank transfer';
    nextSteps = isPaid
      ? 'We have received your payment and your order is confirmed. We will let you know when it ships.'
      : 'We have received your order. Please complete the bank transfer using the details below. Your order is prepared once the transfer arrives.';
  } else if (method === 'card_teb') {
    statusLabel = isPaid ? 'Payment received' : 'Awaiting payment';
    nextSteps = isPaid
      ? 'Your payment has been received and your order is confirmed.'
      : 'Your order is reserved. It will be confirmed once payment is completed.';
  } else {
    statusLabel = isPaid ? 'Payment received' : 'Pending';
    nextSteps = 'We have received your order and will be in touch with the next steps.';
  }
  return { methodLabel, statusLabel, isPaid, nextSteps };
}

function addressLines(order) {
  const a = order.shipping_address && typeof order.shipping_address === 'object' ? order.shipping_address : {};
  const parts = [
    a.line1 || a.address || a.street || '',
    a.line2 || '',
    [a.city, a.state || a.region, a.postalCode || a.postal_code || a.zip].filter(Boolean).join(', '),
    a.country || order.country || '',
  ];
  return parts.map((s) => String(s || '').trim()).filter(Boolean);
}

function bankBlock(bankTransfer) {
  if (!bankTransfer || typeof bankTransfer !== 'object') return null;
  const rows = [
    ['Account holder', bankTransfer.holder],
    ['IBAN', bankTransfer.iban],
    ['Bank', bankTransfer.bank],
    ['SWIFT / BIC', bankTransfer.swift],
  ].filter(([, v]) => v && String(v).trim());
  const instructions = String(bankTransfer.instructions || '').trim();
  if (!rows.length && !instructions) return null;
  return { rows, instructions };
}

// --------------------------------------------------------------------------

function renderOrderConfirmation({ order, items = [], payment = null, contact = null, bankTransfer = null } = {}) {
  if (!order || !order.id) throw new Error('renderOrderConfirmation: order is required');

  const num = orderNumber(order.id);
  const currency = order.currency || 'eur';
  const customerName = String(order.customer_name || '').trim() || 'there';
  const date = formatDate(order.created_at);
  const pay = paymentPresentation(order, payment);

  const lineItems = (Array.isArray(items) ? items : []).map((it) => {
    const qty = Math.max(1, Number(it.quantity) || 1);
    const unit = Number(it.price_cents) || 0;
    return {
      name: String(it.name || 'Item'),
      size: String(it.size || '').trim(),
      qty,
      unitCents: unit,
      lineCents: unit * qty,
    };
  });

  const subtotalCents = Number(order.subtotal_cents) || lineItems.reduce((s, l) => s + l.lineCents, 0);
  const shippingCents = Number(order.shipping_cents) || 0;
  const discountCents = Number(order.discount_cents) || 0;
  const taxCents = Number(order.tax_cents) || 0;
  const totalCents = Number(order.total_cents) || subtotalCents + shippingCents - discountCents + taxCents;

  const addr = addressLines(order);
  const phone = String(order.phone || '').trim();
  const bank = pay.methodLabel === 'Bank transfer' && !pay.isPaid ? bankBlock(bankTransfer) : null;
  const supportEmail = contact && contact.email ? String(contact.email).trim() : '';
  const supportPhone = contact && contact.phone ? String(contact.phone).trim() : '';

  const subject = `${BRAND} — Order ${num} confirmed`;

  // ---- plain text ----------------------------------------------------------
  const t = [];
  t.push(BRAND);
  t.push('ORDER CONFIRMED');
  t.push('');
  t.push(`Thank you, ${customerName}.`);
  t.push(`Your order ${num} has been received on ${date}.`);
  t.push('');
  t.push('This is an automated order confirmation. You do not need to reply to it.');
  t.push('');
  t.push('ORDER DETAILS');
  for (const l of lineItems) {
    const sz = l.size ? `  Size ${l.size}` : '';
    t.push(`- ${l.name}${sz}  x${l.qty}  ${money(l.unitCents, currency)}  =  ${money(l.lineCents, currency)}`);
  }
  t.push('');
  t.push(`Subtotal: ${money(subtotalCents, currency)}`);
  t.push(`Shipping: ${money(shippingCents, currency)}`);
  if (discountCents > 0) t.push(`Discount: -${money(discountCents, currency)}`);
  if (taxCents > 0) t.push(`Tax: ${money(taxCents, currency)}`);
  t.push(`Total: ${money(totalCents, currency)} (${String(currency).toUpperCase()})`);
  t.push('');
  t.push('SHIPPING INFORMATION');
  t.push(String(order.customer_name || '').trim());
  for (const line of addr) t.push(line);
  if (phone) t.push(`Phone: ${phone}`);
  t.push('');
  t.push('PAYMENT');
  t.push(`Method: ${pay.methodLabel}`);
  t.push(`Status: ${pay.statusLabel}`);
  t.push('');
  t.push('NEXT STEPS');
  t.push(pay.nextSteps);
  if (bank) {
    t.push('');
    t.push('BANK TRANSFER DETAILS');
    for (const [k, v] of bank.rows) t.push(`${k}: ${v}`);
    if (bank.instructions) t.push(bank.instructions);
    t.push(`Please use ${num} as the payment reference.`);
  }
  if (supportEmail || supportPhone) {
    t.push('');
    t.push('NEED HELP?');
    if (supportEmail) t.push(`Email: ${supportEmail}`);
    if (supportPhone) t.push(`Phone: ${supportPhone}`);
  }
  t.push('');
  t.push(`${BRAND}`);
  const text = t.join('\n');

  // ---- HTML --------------------------------------------------------------
  const C = {
    paper: '#F7F3ED',
    card: '#FFFFFF',
    ink: '#2B2622',
    soft: '#6B6259',
    line: '#E7DFD3',
    bronze: '#9A6B3F',
  };
  const cell = `padding:8px 0;font:14px/1.6 Georgia,'Times New Roman',serif;color:${C.ink};`;
  const th = `padding:0 0 8px;font:11px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:${C.soft};text-align:left;`;

  const itemRows = lineItems
    .map(
      (l) => `
        <tr>
          <td style="${cell}border-bottom:1px solid ${C.line};">
            ${escapeHtml(l.name)}${l.size ? `<br><span style="font:12px Arial,sans-serif;color:${C.soft};">Size ${escapeHtml(l.size)}</span>` : ''}
          </td>
          <td style="${cell}border-bottom:1px solid ${C.line};text-align:center;white-space:nowrap;">${l.qty}</td>
          <td style="${cell}border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap;">${escapeHtml(money(l.lineCents, currency))}</td>
        </tr>`
    )
    .join('');

  const totalsRows =
    `<tr><td style="${cell}text-align:right;color:${C.soft};">Subtotal</td><td style="${cell}text-align:right;white-space:nowrap;">${escapeHtml(money(subtotalCents, currency))}</td></tr>` +
    `<tr><td style="${cell}text-align:right;color:${C.soft};">Shipping</td><td style="${cell}text-align:right;white-space:nowrap;">${escapeHtml(money(shippingCents, currency))}</td></tr>` +
    (discountCents > 0
      ? `<tr><td style="${cell}text-align:right;color:${C.soft};">Discount</td><td style="${cell}text-align:right;white-space:nowrap;">-${escapeHtml(money(discountCents, currency))}</td></tr>`
      : '') +
    (taxCents > 0
      ? `<tr><td style="${cell}text-align:right;color:${C.soft};">Tax</td><td style="${cell}text-align:right;white-space:nowrap;">${escapeHtml(money(taxCents, currency))}</td></tr>`
      : '') +
    `<tr><td style="${cell}text-align:right;font-weight:bold;border-top:2px solid ${C.ink};">Total (${escapeHtml(String(currency).toUpperCase())})</td><td style="${cell}text-align:right;font-weight:bold;white-space:nowrap;border-top:2px solid ${C.ink};">${escapeHtml(money(totalCents, currency))}</td></tr>`;

  const addrHtml = [escapeHtml(String(order.customer_name || '').trim()), ...addr.map(escapeHtml), phone ? `Phone: ${escapeHtml(phone)}` : '']
    .filter(Boolean)
    .join('<br>');

  const bankHtml = bank
    ? `<tr><td style="padding-top:20px;">
         <div style="${th}">Bank transfer details</div>
         <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
           ${bank.rows.map(([k, v]) => `<tr><td style="${cell}color:${C.soft};width:40%;">${escapeHtml(k)}</td><td style="${cell}">${escapeHtml(v)}</td></tr>`).join('')}
         </table>
         ${bank.instructions ? `<p style="${cell}">${escapeHtml(bank.instructions)}</p>` : ''}
         <p style="${cell}">Please use <strong>${escapeHtml(num)}</strong> as the payment reference.</p>
       </td></tr>`
    : '';

  const supportHtml =
    supportEmail || supportPhone
      ? `<tr><td style="padding-top:20px;border-top:1px solid ${C.line};">
           <div style="${th}">Need help?</div>
           ${supportEmail ? `<div style="${cell}">Email: <a href="mailto:${escapeHtml(supportEmail)}" style="color:${C.bronze};">${escapeHtml(supportEmail)}</a></div>` : ''}
           ${supportPhone ? `<div style="${cell}">Phone: ${escapeHtml(supportPhone)}</div>` : ''}
         </td></tr>`
      : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Order ${escapeHtml(num)} confirmed — automated confirmation from ${BRAND}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td align="center" style="padding-bottom:24px;">
        <div style="font:22px/1 Georgia,serif;letter-spacing:.34em;color:${C.ink};">${BRAND}</div>
      </td></tr>
      <tr><td style="background:${C.card};border:1px solid ${C.line};padding:36px 34px;">
        <div style="font:11px Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:${C.bronze};">Order confirmed</div>
        <h1 style="margin:10px 0 4px;font:400 26px/1.3 Georgia,serif;color:${C.ink};">Thank you, ${escapeHtml(customerName)}.</h1>
        <p style="margin:0 0 4px;font:14px/1.6 Georgia,serif;color:${C.ink};">Your order <strong>${escapeHtml(num)}</strong> has been received on ${escapeHtml(date)}.</p>
        <p style="margin:6px 0 24px;font:12px/1.6 Arial,sans-serif;color:${C.soft};">This is an automated order confirmation — no reply is needed.</p>

        <div style="${th}">Order details</div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:4px;">
          <tr><th style="${th}">Item</th><th style="${th}text-align:center;">Qty</th><th style="${th}text-align:right;">Amount</th></tr>
          ${itemRows}
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${totalsRows}</table>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="padding-top:24px;">
            <div style="${th}">Shipping information</div>
            <div style="${cell}">${addrHtml}</div>
          </td></tr>
          <tr><td style="padding-top:20px;">
            <div style="${th}">Payment</div>
            <div style="${cell}">${escapeHtml(pay.methodLabel)} &nbsp;&bull;&nbsp; ${escapeHtml(pay.statusLabel)}</div>
          </td></tr>
          <tr><td style="padding-top:20px;">
            <div style="${th}">Next steps</div>
            <div style="${cell}">${escapeHtml(pay.nextSteps)}</div>
          </td></tr>
          ${bankHtml}
          ${supportHtml}
        </table>
      </td></tr>
      <tr><td align="center" style="padding:22px 10px;font:11px/1.6 Arial,sans-serif;color:${C.soft};">
        ${BRAND}<br>Automated confirmation for ${escapeHtml(num)}.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  return { subject, html, text };
}

module.exports = { renderOrderConfirmation, escapeHtml, money, orderNumber };
