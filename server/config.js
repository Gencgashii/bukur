'use strict';

/**
 * Central configuration + environment validation for the BUKUR Express API.
 *
 * All secrets come from the environment. This module fails fast (throws on
 * startup) when a required production secret is missing, so the server can
 * never boot in an insecure "fallback secret" state.
 */

require('dotenv').config({ quiet: true });

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in the environment (see .env.example). The server will not start without it.`
    );
  }
  return String(value);
}

function optional(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === null || String(value).trim() === ''
    ? fallback
    : String(value);
}

// ---------------------------------------------------------------------------
// JWT — no insecure fallback. Required in every environment.
// ---------------------------------------------------------------------------
const JWT_SECRET = required('JWT_SECRET');
if (IS_PROD && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}
const JWT_EXPIRES_IN = optional('JWT_EXPIRES_IN', '12h');

// Admin session cookie SameSite policy.
//   'lax'    (default) — works when the admin SPA and API share a registrable
//                        domain (incl. localhost on different ports).
//   'strict' — strongest; same constraint as 'lax' for XHR/fetch.
//   'none'   — required when the admin SPA is on a DIFFERENT domain than the
//              API (e.g. Vercel + Render). Forces Secure; CSRF is then covered
//              by the double-submit token + the CORS allowlist.
const ADMIN_COOKIE_SAMESITE = (() => {
  const v = optional('ADMIN_COOKIE_SAMESITE', 'lax').toLowerCase();
  return ['lax', 'strict', 'none'].includes(v) ? v : 'lax';
})();

// ---------------------------------------------------------------------------
// CORS allowlist. Comma-separated origins. Dev default = CRA dev server.
// ---------------------------------------------------------------------------
const CLIENT_ORIGINS = optional(
  'CLIENT_ORIGINS',
  IS_PROD ? '' : 'http://localhost:3000'
)
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (IS_PROD && CLIENT_ORIGINS.length === 0) {
  throw new Error('CLIENT_ORIGINS must list at least one allowed origin in production.');
}

// ---------------------------------------------------------------------------
// Shipping rates. Structured by ISO country code. Cents. No free-text matching.
// These mirror the business rules already used by the storefront
// (Kosovo Post / Albania Post). Adjust here only.
// ---------------------------------------------------------------------------
const SHIPPING_RATES_CENTS = (() => {
  const raw = optional('SHIPPING_RATES', 'XK:180,AL:480');
  const map = {};
  for (const pair of raw.split(',')) {
    const [code, cents] = pair.split(':').map((s) => s.trim());
    if (code && /^\d+$/.test(cents || '')) map[code.toUpperCase()] = Number(cents);
  }
  return map;
})();
const SUPPORTED_COUNTRIES = Object.keys(SHIPPING_RATES_CENTS);

// ---------------------------------------------------------------------------
// Tax. NO business rule is defined for BUKUR yet. Defaults to 0 (unchanged
// behaviour). Do NOT invent a VAT rate here — set TAX_RATE_BPS explicitly
// once the business confirms (e.g. Kosovo VAT would be 1800 = 18.00%).
// ---------------------------------------------------------------------------
const TAX_RATE_BPS = Number(optional('TAX_RATE_BPS', '0')) || 0; // basis points

const CURRENCY = optional('CURRENCY', 'eur').toLowerCase();

// ---------------------------------------------------------------------------
// Payment methods. Explicit identifiers. Only card_teb can ever become "paid"
// via a verified provider callback. bank_transfer / cash_on_delivery are
// created as unpaid and confirmed manually by an admin.
// ---------------------------------------------------------------------------
const PAYMENT_METHODS = Object.freeze({
  CARD_TEB: 'card_teb',
  BANK_TRANSFER: 'bank_transfer',
  CASH_ON_DELIVERY: 'cash_on_delivery',
});
const ALLOWED_PAYMENT_METHODS = Object.values(PAYMENT_METHODS);

// Cash on delivery is only offered when the business explicitly enables it.
const ENABLE_COD = optional('ENABLE_COD', 'true') === 'true';

// Mock payment provider is for local/dev/test ONLY and can never run in prod.
const PAYMENTS_ALLOW_MOCK = !IS_PROD && optional('PAYMENTS_ALLOW_MOCK', 'true') === 'true';
const PAYMENTS_MOCK_SECRET = optional('PAYMENTS_MOCK_SECRET', 'dev-mock-secret');

const ALLOW_ADMIN_REGISTER = optional('ALLOW_ADMIN_REGISTER', '') === 'true';

// ---------------------------------------------------------------------------
// Transactional email (order confirmations).
//   EMAIL_ENABLED   'true' to actually send. Default false (safe for dev/CI).
//   EMAIL_PROVIDER  'console' (dev: logs + writes .mail-preview/, never sends)
//                   'memory'  (tests only: records to an in-process outbox)
//                   'resend'  (production: Resend HTTP API, needs RESEND_API_KEY)
//   EMAIL_FROM      required when enabled, e.g. "BUKUR WORLD <orders@example.com>"
//   EMAIL_REPLY_TO  optional Reply-To header
//   EMAIL_STORE_URL optional absolute https base for links in the email
// Provider secrets (RESEND_API_KEY, SMTP_*) are read inside the provider, never
// here, and never returned to any client.
// ---------------------------------------------------------------------------
const EMAIL_ENABLED = optional('EMAIL_ENABLED', 'false') === 'true';
const EMAIL_PROVIDER = optional('EMAIL_PROVIDER', 'console').toLowerCase();
const EMAIL_FROM = optional('EMAIL_FROM', '');
const EMAIL_REPLY_TO = optional('EMAIL_REPLY_TO', '');
const EMAIL_STORE_URL = optional('EMAIL_STORE_URL', '').replace(/\/$/, '');

const NON_PROD_EMAIL_PROVIDERS = new Set(['console', 'memory']);
if (EMAIL_ENABLED) {
  if (!EMAIL_FROM) {
    throw new Error('EMAIL_ENABLED=true but EMAIL_FROM is not set. Set EMAIL_FROM (see .env.example).');
  }
  if (IS_PROD && NON_PROD_EMAIL_PROVIDERS.has(EMAIL_PROVIDER)) {
    throw new Error(
      `EMAIL_PROVIDER="${EMAIL_PROVIDER}" cannot be used in production. Set EMAIL_PROVIDER=resend and RESEND_API_KEY.`
    );
  }
  if (!['console', 'memory', 'resend'].includes(EMAIL_PROVIDER)) {
    throw new Error(`Unknown EMAIL_PROVIDER "${EMAIL_PROVIDER}". Use "console", "memory" or "resend".`);
  }
}

const PORT = Number(optional('PORT', '9000'));

module.exports = {
  NODE_ENV,
  IS_PROD,
  PORT,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  ADMIN_COOKIE_SAMESITE,
  CLIENT_ORIGINS,
  SHIPPING_RATES_CENTS,
  SUPPORTED_COUNTRIES,
  TAX_RATE_BPS,
  CURRENCY,
  PAYMENT_METHODS,
  ALLOWED_PAYMENT_METHODS,
  ENABLE_COD,
  PAYMENTS_ALLOW_MOCK,
  PAYMENTS_MOCK_SECRET,
  ALLOW_ADMIN_REGISTER,
  EMAIL_ENABLED,
  EMAIL_PROVIDER,
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  EMAIL_STORE_URL,
};
