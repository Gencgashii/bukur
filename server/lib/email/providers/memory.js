'use strict';

/**
 * In-process email transport for automated tests. NEVER sends anything.
 * Records each message in `outbox`; tests import it to assert.
 * Blocked in production by config validation.
 */

const outbox = [];

function makeMemoryProvider() {
  return {
    name: 'memory',
    async send({ to, from, replyTo, subject, html, text, headers }) {
      const id = `mem-${outbox.length + 1}`;
      outbox.push({ id, to, from, replyTo, subject, html, text, headers, at: new Date().toISOString() });
      return { ok: true, id };
    },
  };
}

function _clearOutbox() {
  outbox.length = 0;
}

module.exports = { makeMemoryProvider, outbox, _clearOutbox };
