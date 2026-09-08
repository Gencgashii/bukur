'use strict';

const { query } = require('../db');

/**
 * Append-only admin audit trail.
 *
 * `meta` MUST be small and non-sensitive: field names + short scalar values,
 * never passwords / tokens / payment secrets / full customer records. Callers
 * are responsible for what they pass; this helper additionally caps the size.
 *
 * Pass a transaction `client` to record the entry atomically with the change;
 * omit it to log best-effort (failures are swallowed so auditing can never
 * break a business operation).
 */
async function writeAudit(client, { adminId, action, entityType, entityId = '', meta = {} }) {
  let safeMeta = {};
  try {
    safeMeta = JSON.parse(JSON.stringify(meta));
    const s = JSON.stringify(safeMeta);
    if (s.length > 4000) safeMeta = { note: 'meta omitted (too large)' };
  } catch {
    safeMeta = {};
  }
  const runner = client || { query };
  try {
    await runner.query(
      `INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, meta)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [adminId || null, String(action), String(entityType), String(entityId).slice(0, 64), JSON.stringify(safeMeta)]
    );
  } catch (e) {
    if (client) throw e; // inside a txn the caller decides
    console.warn('[audit] failed to record', String(action), e.message);
  }
}

module.exports = { writeAudit };
