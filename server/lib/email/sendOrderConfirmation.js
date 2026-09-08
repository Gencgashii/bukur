'use strict';

/**
 * Order-confirmation email orchestration (the "email service" seam between the
 * order flow and the transport).
 *
 *   sendOrderConfirmationForOrder(orderId, { force?, trigger? })
 *     -> { status: 'sent' | 'failed' | 'skipped', category?, id?, alreadySent? }
 *
 * Guarantees:
 *  - NEVER throws for the order-creation path — a mail failure must not touch a
 *    successfully persisted order. (The admin retry route may inspect the
 *    returned status.)
 *  - Idempotent: an already-'sent' order is not re-sent unless `force` (admin).
 *  - Bounded: a per-order hard attempt cap stops retry storms.
 *  - Reads ONLY persisted server-side data (orders row, order_items, latest
 *    payment, store settings). Never trusts client input.
 *  - Persists an operational status only — never the email body or secrets.
 */

const { query } = require('../../db');
const { getEmailService } = require('./index');
const { renderOrderConfirmation, orderNumber } = require('./render');

const HARD_ATTEMPT_CAP = 8;

async function loadSettings() {
  try {
    const rows = (await query(`SELECT key, value FROM store_settings`)).rows;
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  } catch {
    return {};
  }
}

async function sendOrderConfirmationForOrder(orderId, { force = false, trigger = 'order_created' } = {}) {
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) return { status: 'failed', category: 'bad_input' };

  const email = getEmailService();
  const num = orderNumber(id);

  // ---- email disabled: mark skipped once, do not inflate attempts ----------
  if (!email.enabled) {
    await query(
      `UPDATE orders SET confirmation_email_status = 'skipped', updated_at = NOW()
        WHERE id = $1 AND confirmation_email_status = 'pending'`,
      [id]
    );
    return { status: 'skipped', category: 'disabled' };
  }

  // ---- atomically claim this send (idempotency + bounded retry) -----------
  const claim = await query(
    `UPDATE orders
        SET confirmation_email_attempts = confirmation_email_attempts + 1,
            updated_at = NOW()
      WHERE id = $1
        AND confirmation_email_attempts < $2
        AND ($3::boolean OR confirmation_email_status IN ('pending', 'failed'))
      RETURNING *`,
    [id, HARD_ATTEMPT_CAP, force === true]
  );

  if (!claim.rows[0]) {
    const cur = (await query(`SELECT confirmation_email_status, confirmation_email_attempts FROM orders WHERE id = $1`, [id]))
      .rows[0];
    if (!cur) return { status: 'failed', category: 'order_not_found' };
    if (cur.confirmation_email_status === 'sent') return { status: 'sent', alreadySent: true };
    return { status: cur.confirmation_email_status || 'failed', category: 'attempt_cap_or_locked' };
  }

  const order = claim.rows[0];
  const items = (await query(`SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`, [id])).rows;
  const payment = (await query(`SELECT * FROM payments WHERE order_id = $1 ORDER BY id DESC LIMIT 1`, [id])).rows[0] || null;
  const settings = await loadSettings();

  let rendered;
  try {
    rendered = renderOrderConfirmation({
      order,
      items,
      payment,
      contact: settings.contact || null,
      bankTransfer: settings.bank_transfer || null,
    });
  } catch (e) {
    await markFailed(id, 'render_error');
    console.warn('[email] render failed', { order: num, trigger });
    return { status: 'failed', category: 'render_error' };
  }

  try {
    const res = await email.send({
      to: order.customer_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    await query(
      `UPDATE orders
          SET confirmation_email_status = 'sent',
              confirmation_email_sent_at = NOW(),
              confirmation_email_error = '',
              updated_at = NOW()
        WHERE id = $1`,
      [id]
    );
    console.log(`[email] order confirmation sent order=${num} provider=${res.providerName} trigger=${trigger}`);
    return { status: 'sent', id: res.id || null };
  } catch (e) {
    const category = (e && e.details && e.details.category) || e.category || 'unknown';
    await markFailed(id, category);
    console.warn(`[email] order confirmation failed order=${num} category=${category} trigger=${trigger}`);
    return { status: 'failed', category };
  }
}

async function markFailed(id, category) {
  await query(
    `UPDATE orders
        SET confirmation_email_status = 'failed',
            confirmation_email_error = $2,
            updated_at = NOW()
      WHERE id = $1`,
    [id, String(category || 'unknown').slice(0, 40)]
  );
}

module.exports = { sendOrderConfirmationForOrder, HARD_ATTEMPT_CAP };
