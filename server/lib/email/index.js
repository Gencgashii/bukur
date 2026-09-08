'use strict';

/**
 * Email service abstraction.
 *
 *   const email = getEmailService();
 *   email.enabled        -> boolean (config.EMAIL_ENABLED)
 *   email.providerName   -> 'console' | 'memory' | 'resend'
 *   await email.send({ to, subject, html, text })
 *        -> { ok:true, id, providerName }
 *        -> throws AppError('email_send_failed', <safe>, 502, { category })
 *
 * The rest of the app depends only on this interface, never on a provider.
 * Recipient + subject are sanitised here (header / CRLF injection defence).
 * Bounded retry (≤ 3 attempts) on transient provider failures.
 */

const config = require('../../config');
const { AppError } = require('../errors');
const { makeConsoleProvider } = require('./providers/console');
const { makeMemoryProvider } = require('./providers/memory');
const { makeResendProvider } = require('./providers/resend');

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 150;
const RETRYABLE = new Set(['provider_5xx', 'timeout', 'network']);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Trusted-order-data recipient still gets a hard sanity + injection check. */
function assertSafeRecipient(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw || raw.length > 160) {
    throw new AppError('invalid_recipient', 'A valid recipient email is required.', 400, { category: 'invalid_recipient' });
  }
  if (/[\r\n\t<>,;"]/.test(raw) || raw.includes(' ')) {
    throw new AppError('invalid_recipient', 'The recipient email is not in a valid form.', 400, {
      category: 'invalid_recipient',
    });
  }
  if (!EMAIL_RE.test(raw)) {
    throw new AppError('invalid_recipient', 'The recipient email is not in a valid form.', 400, {
      category: 'invalid_recipient',
    });
  }
  return raw.toLowerCase();
}

function sanitizeHeaderText(value) {
  // strip CR/LF so a subject can never inject headers
  return String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').trim();
}

function buildProvider(name) {
  if (name === 'memory') return makeMemoryProvider();
  if (name === 'resend') return makeResendProvider(); // throws if RESEND_API_KEY missing
  return makeConsoleProvider();
}

async function sendWithRetry(provider, message) {
  let lastCategory = 'unknown';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const r = await provider.send(message);
      if (!r || r.ok !== true || !r.id) {
        lastCategory = 'bad_response';
        throw Object.assign(new Error('provider returned no id'), { category: 'bad_response' });
      }
      return { ok: true, id: r.id, attempts: attempt };
    } catch (e) {
      lastCategory = (e && e.category) || 'unknown';
      if (!RETRYABLE.has(lastCategory) || attempt === MAX_ATTEMPTS) break;
      await new Promise((res) => setTimeout(res, RETRY_BASE_MS * attempt));
    }
  }
  throw new AppError('email_send_failed', 'The confirmation email could not be sent.', 502, {
    category: lastCategory,
  });
}

let instance = null;

function getEmailService() {
  if (instance) return instance;

  const enabled = config.EMAIL_ENABLED;
  const providerName = config.EMAIL_PROVIDER;
  const from = config.EMAIL_FROM;
  const replyTo = config.EMAIL_REPLY_TO || '';

  // Construct the provider eagerly only when email is enabled, so a missing
  // RESEND_API_KEY fails at boot rather than on the first order.
  let provider = enabled ? buildProvider(providerName) : null;

  instance = {
    enabled,
    providerName,
    from,
    replyTo,

    // test seam — swap the transport without touching config or the network
    __setProviderForTests(p) {
      provider = p;
    },

    async send({ to, subject, html, text }) {
      if (!enabled) {
        return { ok: true, id: null, providerName, skipped: true };
      }
      const recipient = assertSafeRecipient(to);
      const cleanSubject = sanitizeHeaderText(subject);
      if (!cleanSubject) {
        throw new AppError('email_send_failed', 'Email subject is empty.', 500, { category: 'bad_input' });
      }
      if (!html && !text) {
        throw new AppError('email_send_failed', 'Email body is empty.', 500, { category: 'bad_input' });
      }

      const r = await sendWithRetry(provider, {
        to: recipient,
        from,
        replyTo: replyTo || undefined,
        subject: cleanSubject,
        html,
        text,
      });
      return { ok: true, id: r.id, providerName, attempts: r.attempts };
    },
  };
  return instance;
}

function _resetEmailServiceForTests() {
  instance = null;
}

module.exports = {
  getEmailService,
  assertSafeRecipient,
  sanitizeHeaderText,
  buildProvider,
  sendWithRetry,
  _resetEmailServiceForTests,
  MAX_ATTEMPTS,
};
