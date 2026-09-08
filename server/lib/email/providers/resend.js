'use strict';

/**
 * Production transport: Resend transactional email HTTP API.
 * https://resend.com  —  POST https://api.resend.com/emails
 *
 * No SDK (native fetch). The API key is read from the environment here and
 * never leaves this module — not returned, not logged, not in error messages.
 *
 * Swappable: any other provider (SMTP via nodemailer, SendGrid, Postmark, ...)
 * can be added as a sibling file implementing the same `{ name, send() }`.
 */

const { AppError } = require('../../errors');

const ENDPOINT = 'https://api.resend.com/emails';
const ATTEMPT_TIMEOUT_MS = 5000;

function makeResendProvider() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    // fail closed — never silently degrade
    throw new AppError(
      'email_not_configured',
      'EMAIL_PROVIDER=resend but RESEND_API_KEY is not set.',
      500,
      { provider: 'resend', missingEnv: ['RESEND_API_KEY'] }
    );
  }

  return {
    name: 'resend',
    async send({ to, from, replyTo, subject, html, text }) {
      const payload = {
        from,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
      let res;
      try {
        res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (e) {
        const category = e && e.name === 'AbortError' ? 'timeout' : 'network';
        const err = new Error(`resend ${category}`);
        err.category = category;
        throw err;
      } finally {
        clearTimeout(timer);
      }

      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!res.ok) {
        const err = new Error(`resend responded ${res.status}`);
        err.category = res.status >= 500 ? 'provider_5xx' : 'provider_4xx';
        err.status = res.status;
        throw err;
      }
      if (!body || typeof body.id !== 'string') {
        const err = new Error('resend: malformed success response');
        err.category = 'bad_response';
        throw err;
      }
      return { ok: true, id: body.id };
    },
  };
}

module.exports = { makeResendProvider };
