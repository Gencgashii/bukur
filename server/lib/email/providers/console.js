'use strict';

/**
 * Development email transport. NEVER sends a real email.
 *
 * Writes the rendered message to  <repo>/.mail-preview/  (git-ignored) so a
 * developer can open the HTML, and logs a single redacted line. Blocked in
 * production by config validation.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PREVIEW_DIR = path.join(__dirname, '..', '..', '..', '..', '.mail-preview');

function redact(addr) {
  const s = String(addr || '');
  const at = s.indexOf('@');
  if (at < 1) return '***';
  return `${s[0]}***${s.slice(at)}`;
}

function makeConsoleProvider() {
  return {
    name: 'console',
    async send({ to, subject, html, text }) {
      const id = `console-${crypto.randomUUID()}`;
      try {
        fs.mkdirSync(PREVIEW_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const base = path.join(PREVIEW_DIR, `${stamp}-${id}`);
        fs.writeFileSync(`${base}.html`, html || '', 'utf8');
        fs.writeFileSync(`${base}.txt`, text || '', 'utf8');
      } catch (e) {
        // preview is best-effort; still report "sent" for the dev transport
        console.warn('[email] (console) could not write preview file:', e.message);
      }
      console.log(`[email] (console, DEV — not sent) to=${redact(to)} subject=${JSON.stringify(String(subject || ''))}`);
      return { ok: true, id };
    },
  };
}

module.exports = { makeConsoleProvider, PREVIEW_DIR };
