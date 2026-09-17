'use strict';

/**
 * Owner/admin "new order" notification — mirrors sendOrderConfirmation.js's
 * guarantees exactly, on its own separate status/attempt columns so a
 * customer-email failure/retry can never suppress or duplicate this one:
 *
 *   sendOwnerNotificationForOrder(orderId, { force?, trigger? })
 *     -> { status: 'sent' | 'failed' | 'skipped', category?, id?, alreadySent? }
 *
 * Guarantees:
 *  - NEVER throws for the order-creation path — a notification failure must
 *    not touch a successfully persisted order.
 *  - Idempotent: an already-'sent' order is not re-sent unless `force`.
 *  - Bounded: a per-order hard attempt cap stops retry storms.
 *  - Skipped (not an error) when OWNER_NOTIFICATION_EMAIL is unset — the
 *    store simply hasn't configured an owner inbox yet.
 *  - Reads ONLY persisted server-side data. Never trusts client input.
 */

const { query } = require('../../db');
const config = require('../../config');
const { getEmailService } = require('./index');
const { renderOwnerNotification, orderNumber } = require('./render');

const HARD_ATTEMPT_CAP = 8;

async function sendOwnerNotificationForOrder(orderId, { force = false, trigger = 'order_created' } = {}) {
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) return { status: 'failed', category: 'bad_input' };

  const num = orderNumber(id);
  const email = getEmailService();

  // ---- no owner address configured: mark skipped once, do not inflate attempts ----
  if (!config.OWNER_NOTIFICATION_EMAIL || !email.enabled) {
    await query(
      `UPDATE orders SET owner_notification_status = 'skipped', updated_at = NOW()
        WHERE id = $1 AND owner_notification_status = 'pending'`,
      [id]
    );
    return { status: 'skipped', category: config.OWNER_NOTIFICATION_EMAIL ? 'disabled' : 'no_owner_address' };
  }

  // ---- atomically claim this send (idempotency + bounded retry) -----------
  const claim = await query(
    `UPDATE orders
        SET owner_notification_attempts = owner_notification_attempts + 1,
            updated_at = NOW()
      WHERE id = $1
        AND owner_notification_attempts < $2
        AND ($3::boolean OR owner_notification_status IN ('pending', 'failed'))
      RETURNING *`,
    [id, HARD_ATTEMPT_CAP, force === true]
  );

  if (!claim.rows[0]) {
    const cur = (await query(`SELECT owner_notification_status, owner_notification_attempts FROM orders WHERE id = $1`, [id]))
      .rows[0];
    if (!cur) return { status: 'failed', category: 'order_not_found' };
    if (cur.owner_notification_status === 'sent') return { status: 'sent', alreadySent: true };
    return { status: cur.owner_notification_status || 'failed', category: 'attempt_cap_or_locked' };
  }

  const order = claim.rows[0];
  const items = (await query(`SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`, [id])).rows;

  let rendered;
  try {
    rendered = renderOwnerNotification({ order, items });
  } catch (e) {
    await markFailed(id, 'render_error');
    console.warn('[owner-notify] render failed', { order: num, trigger });
    return { status: 'failed', category: 'render_error' };
  }

  try {
    const res = await email.send({
      to: config.OWNER_NOTIFICATION_EMAIL,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    await query(
      `UPDATE orders
          SET owner_notification_status = 'sent',
              owner_notification_sent_at = NOW(),
              owner_notification_error = '',
              updated_at = NOW()
        WHERE id = $1`,
      [id]
    );
    console.log(`[owner-notify] sent order=${num} provider=${res.providerName} trigger=${trigger}`);
    return { status: 'sent', id: res.id || null };
  } catch (e) {
    const category = (e && e.details && e.details.category) || e.category || 'unknown';
    await markFailed(id, category);
    console.warn(`[owner-notify] failed order=${num} category=${category} trigger=${trigger}`);
    return { status: 'failed', category };
  }
}

async function markFailed(id, category) {
  await query(
    `UPDATE orders
        SET owner_notification_status = 'failed',
            owner_notification_error = $2,
            updated_at = NOW()
      WHERE id = $1`,
    [id, String(category || 'unknown').slice(0, 40)]
  );
}

module.exports = { sendOwnerNotificationForOrder, HARD_ATTEMPT_CAP };
