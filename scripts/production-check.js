'use strict';
/**
 * Production configuration validator for the BUKUR WORLD API.
 *
 *   npm run production:check            # evaluate the current environment
 *   npm run production:check -- --strict  # apply production rules even if NODE_ENV != production
 *
 * - Reports every relevant variable: name / scope / required / secret / status.
 * - NEVER prints a secret value — only "configured" / "MISSING" / "INVALID: <why>".
 * - Fails closed (exit 1) on any BLOCKING misconfiguration in production/strict
 *   mode. Non-blocking advisories exit 0.
 *
 * This complements (does not replace) the boot-time fail-closed checks already
 * in server/config.js, server/lib/storage.js and server/lib/email/index.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
(function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
})();

const STRICT = process.argv.includes('--strict');
const NODE_ENV = process.env.NODE_ENV || 'development';
const PROD = NODE_ENV === 'production' || STRICT;

const env = (k) => {
  const v = process.env[k];
  return v === undefined || v === null ? '' : String(v).trim();
};

const rows = [];
let blocking = 0;
let advisories = 0;

/** kind: 'ok' | 'block' | 'warn' | 'info' ; never pass a secret value here. */
function report(name, { scope, secret = false, required = false, status, kind = 'ok', note = '' }) {
  rows.push({ name, scope, secret: secret ? 'secret' : 'public', required: required ? 'yes' : 'no', status, kind, note });
  if (kind === 'block') blocking += 1;
  if (kind === 'warn') advisories += 1;
}

const isHttpsUrl = (s) => {
  try {
    const u = new URL(s);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
};
const isLoopback = (h) => h === 'localhost' || h === '127.0.0.1' || h === '::1';

// ---------------------------------------------------------------------------
// core
// ---------------------------------------------------------------------------
report('NODE_ENV', {
  scope: 'server', required: true,
  status: NODE_ENV,
  kind: PROD && NODE_ENV !== 'production' ? 'warn' : 'ok',
  note: PROD && NODE_ENV !== 'production' ? 'strict mode: production expects NODE_ENV=production' : '',
});

{
  const s = env('JWT_SECRET');
  let kind = 'ok';
  let status = 'configured';
  if (!s) { kind = PROD ? 'block' : 'warn'; status = 'MISSING'; }
  else if (PROD && s.length < 32) { kind = 'block'; status = 'INVALID: < 32 chars in production'; }
  else if (/^(changeme|secret|test|dev|placeholder|your[-_])/i.test(s) || /^(.)\1+$/.test(s)) {
    kind = PROD ? 'block' : 'warn'; status = 'INVALID: looks like a placeholder / low entropy';
  }
  report('JWT_SECRET', { scope: 'server', secret: true, required: true, status, kind });
}

report('JWT_EXPIRES_IN', { scope: 'server', status: env('JWT_EXPIRES_IN') || 'default 12h', kind: 'info' });

// ---- database ----
{
  const url = env('DATABASE_URL');
  const dbSsl = env('DATABASE_SSL').toLowerCase();
  if (!url) {
    report('DATABASE_URL', { scope: 'server', secret: true, required: true, status: 'MISSING', kind: PROD ? 'block' : 'warn' });
  } else {
    let u;
    try { u = new URL(url); } catch { u = null; }
    if (!u || !/^postgres(ql)?:$/.test(u.protocol)) {
      report('DATABASE_URL', { scope: 'server', secret: true, required: true, status: 'INVALID: not a postgres:// URL', kind: 'block' });
    } else {
      const managed = !isLoopback(u.hostname);
      const hasTls = Boolean(u.searchParams.get('sslmode')) || dbSsl === 'true' || dbSsl === 'strict';
      if (PROD && managed && !hasTls) {
        report('DATABASE_URL', {
          scope: 'server', secret: true, required: true,
          status: 'INVALID: managed host without TLS (set DATABASE_SSL=true or sslmode= in the URL)', kind: 'block',
        });
      } else {
        report('DATABASE_URL', { scope: 'server', secret: true, required: true, status: 'configured', kind: 'ok' });
      }
      if (PROD && isLoopback(u.hostname)) {
        report('DATABASE_URL (host)', { scope: 'server', status: 'WARN: points at localhost in production mode', kind: 'warn' });
      }
    }
  }
  report('DATABASE_SSL', {
    scope: 'server',
    status: dbSsl ? dbSsl : '(unset — only OK for a no-TLS/private connection)',
    kind: 'info',
  });
}

// ---- CORS ----
{
  const raw = env('CLIENT_ORIGINS');
  const list = raw.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  if (!list.length) {
    report('CLIENT_ORIGINS', { scope: 'server', required: true, status: 'MISSING', kind: PROD ? 'block' : 'warn' });
  } else if (list.includes('*')) {
    report('CLIENT_ORIGINS', { scope: 'server', required: true, status: 'INVALID: wildcard "*" with credentialed CORS', kind: 'block' });
  } else {
    const bad = list.filter((o) => {
      try {
        const u = new URL(o);
        if (PROD) return u.protocol !== 'https:' || isLoopback(u.hostname);
        return false;
      } catch {
        return true;
      }
    });
    report('CLIENT_ORIGINS', {
      scope: 'server', required: true,
      status: bad.length ? `INVALID: not https / localhost in prod -> ${bad.join(', ')}` : `configured (${list.length} origin${list.length > 1 ? 's' : ''})`,
      kind: bad.length ? 'block' : 'ok',
    });
  }
}

// ---- cookies / HTTPS ----
{
  const ss = (env('ADMIN_COOKIE_SAMESITE') || 'lax').toLowerCase();
  const valid = ['lax', 'strict', 'none'].includes(ss);
  let kind = 'ok';
  let note = '';
  if (!valid) { kind = 'block'; note = 'must be lax | strict | none'; }
  else if (PROD && ss !== 'none') {
    kind = 'warn';
    note = 'if the storefront/admin and the API are on DIFFERENT registrable domains (typical Vercel + Render), this MUST be "none" or the admin session cookie is not sent and admin login silently fails.';
  }
  report('ADMIN_COOKIE_SAMESITE', { scope: 'server', status: ss, kind, note });
  report('Secure cookies', { scope: 'server', status: PROD ? 'enforced (IS_PROD => Secure)' : 'off (dev)', kind: 'info' });
}

// ---- media storage ----
{
  const driver = (env('STORAGE_DRIVER') || 'local').toLowerCase();
  if (!['local', 's3'].includes(driver)) {
    report('STORAGE_DRIVER', { scope: 'server', required: true, status: `INVALID: "${driver}" (use local | s3)`, kind: 'block' });
  } else if (PROD && driver === 'local') {
    report('STORAGE_DRIVER', {
      scope: 'server', required: true, status: 'INVALID: "local" in production (Render disk is ephemeral)', kind: 'block',
    });
  } else {
    report('STORAGE_DRIVER', { scope: 'server', required: true, status: driver, kind: 'ok' });
  }
  const S3_REQ = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL'];
  const s3Secret = new Set(['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']);
  if (driver === 's3') {
    for (const k of S3_REQ) {
      const val = env(k);
      let status = val ? 'configured' : 'MISSING';
      let kind = val ? 'ok' : 'block';
      if (k === 'S3_PUBLIC_BASE_URL' && val && !isHttpsUrl(val)) { status = 'INVALID: not https://'; kind = 'block'; }
      report(k, { scope: 'server', secret: s3Secret.has(k), required: true, status, kind });
    }
    for (const k of ['S3_ENDPOINT', 'S3_FORCE_PATH_STYLE']) {
      report(k, { scope: 'server', status: env(k) ? 'configured (optional)' : '(unset — optional; needed for non-AWS providers)', kind: 'info' });
    }
  } else {
    for (const k of [...S3_REQ, 'S3_ENDPOINT', 'S3_FORCE_PATH_STYLE']) {
      report(k, { scope: 'server', secret: s3Secret.has(k), status: 'n/a (STORAGE_DRIVER != s3)', kind: 'info' });
    }
  }
  report('MEDIA_PUBLIC_BASE_URL', { scope: 'server', status: env('MEDIA_PUBLIC_BASE_URL') ? 'configured (local driver only)' : '(unset — local driver only)', kind: 'info' });
}

// ---- email ----
{
  const enabled = env('EMAIL_ENABLED') === 'true';
  const provider = (env('EMAIL_PROVIDER') || 'console').toLowerCase();
  report('EMAIL_ENABLED', {
    scope: 'server', status: enabled ? 'true' : 'false',
    kind: PROD && !enabled ? 'warn' : 'ok',
    note: PROD && !enabled ? 'order-confirmation emails are OFF; enable for launch unless intentionally deferred' : '',
  });
  if (enabled) {
    const provOk = ['console', 'memory', 'resend'].includes(provider);
    let pKind = 'ok';
    let pStatus = provider;
    if (!provOk) { pKind = 'block'; pStatus = `INVALID: "${provider}"`; }
    else if (PROD && provider !== 'resend') { pKind = 'block'; pStatus = `INVALID: "${provider}" not allowed in production`; }
    report('EMAIL_PROVIDER', { scope: 'server', status: pStatus, kind: pKind });

    const from = env('EMAIL_FROM');
    const fromOk = /^(.+\s)?<?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(from);
    report('EMAIL_FROM', {
      scope: 'server', required: true,
      status: !from ? 'MISSING' : fromOk ? 'configured' : 'INVALID: not "Name <local@domain>"',
      kind: !from || !fromOk ? 'block' : 'ok',
      note: from && fromOk ? 'sender domain SPF/DKIM verification in Resend must be confirmed manually' : '',
    });
    report('EMAIL_REPLY_TO', { scope: 'server', status: env('EMAIL_REPLY_TO') ? 'configured (optional)' : '(unset — optional)', kind: 'info' });
    const storeUrl = env('EMAIL_STORE_URL');
    report('EMAIL_STORE_URL', {
      scope: 'server',
      status: !storeUrl ? '(unset — optional)' : isHttpsUrl(storeUrl) ? 'configured (optional)' : 'INVALID: not https://',
      kind: storeUrl && !isHttpsUrl(storeUrl) ? 'block' : 'info',
    });
    if (provider === 'resend') {
      const key = env('RESEND_API_KEY');
      report('RESEND_API_KEY', {
        scope: 'server', secret: true, required: true,
        status: key ? 'configured' : 'MISSING', kind: key ? 'ok' : 'block',
      });
    } else {
      report('RESEND_API_KEY', { scope: 'server', secret: true, status: 'n/a (provider != resend)', kind: 'info' });
    }
  } else {
    for (const k of ['EMAIL_PROVIDER', 'EMAIL_FROM', 'EMAIL_REPLY_TO', 'EMAIL_STORE_URL']) {
      report(k, { scope: 'server', status: 'n/a (EMAIL_ENABLED != true)', kind: 'info' });
    }
    report('RESEND_API_KEY', { scope: 'server', secret: true, status: 'n/a (email disabled)', kind: 'info' });
  }
}

// ---- payments ----
{
  const allowMock = env('PAYMENTS_ALLOW_MOCK') === 'true';
  report('PAYMENTS_ALLOW_MOCK', {
    scope: 'server',
    status: PROD ? 'forced OFF in production (server/config.js)' : allowMock ? 'true (dev/test only)' : 'false',
    kind: 'info',
  });
  report('PAYMENTS_CARD_PROVIDER', { scope: 'server', status: env('PAYMENTS_CARD_PROVIDER') || 'teb', kind: 'info', note: 'TEB is a blocked stub until its dedicated phase' });
  report('ENABLE_COD', { scope: 'server', status: env('ENABLE_COD') || 'true', kind: 'info' });
}

// ---- pricing / shipping (server-authoritative, non-secret) ----
report('SHIPPING_RATES', { scope: 'server', status: env('SHIPPING_RATES') || 'default XK:180,AL:480', kind: 'info' });
report('TAX_RATE_BPS', { scope: 'server', status: env('TAX_RATE_BPS') || '0', kind: 'info' });
report('CURRENCY', { scope: 'server', status: env('CURRENCY') || 'eur', kind: 'info' });
report('ALLOW_ADMIN_REGISTER', {
  scope: 'server',
  status: env('ALLOW_ADMIN_REGISTER') === 'true' ? 'true' : 'unset/false',
  kind: PROD && env('ALLOW_ADMIN_REGISTER') === 'true' ? 'warn' : 'info',
  note: env('ALLOW_ADMIN_REGISTER') === 'true' ? 'one-off admin bootstrap only — unset again immediately after' : '',
});

// ---- frontend (build-time, PUBLIC) ----
{
  const api = env('REACT_APP_API_URL');
  let apiHost = '';
  try { apiHost = new URL(api).hostname; } catch { /* ignore */ }
  const apiHttps = isHttpsUrl(api);
  const apiLoopback = isLoopback(apiHost);
  let apiKind = 'ok';
  let apiStatus = 'configured';
  if (!api) { apiStatus = 'MISSING (Vercel build must set it)'; apiKind = PROD ? 'block' : 'warn'; }
  else if (PROD && apiLoopback) { apiStatus = 'INVALID: localhost in production'; apiKind = 'block'; }
  else if (PROD && !apiHttps) { apiStatus = 'INVALID: not https:// (HTTPS storefront cannot call it — mixed content)'; apiKind = 'block'; }
  else if (apiLoopback || !apiHttps) { apiStatus = 'WARN: localhost / not https'; apiKind = 'warn'; }
  report('REACT_APP_API_URL', {
    scope: 'client (build)', required: true, status: apiStatus, kind: apiKind,
    note: 'set at BUILD time in Vercel; the API never sees this var',
  });
  for (const k of ['REACT_APP_BANK_HOLDER', 'REACT_APP_BANK_IBAN', 'REACT_APP_BANK_NAME', 'REACT_APP_BANK_SWIFT']) {
    report(k, { scope: 'client (build)', status: env(k) ? 'configured (public)' : '(unset — public checkout copy)', kind: 'info' });
  }
}

// ---------------------------------------------------------------------------
// output
// ---------------------------------------------------------------------------
const MARK = { ok: ' ok ', block: 'FAIL', warn: 'warn', info: ' -- ' };
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nBUKUR production configuration check  —  mode: ${PROD ? 'PRODUCTION' + (STRICT && NODE_ENV !== 'production' ? ' (--strict)' : '') : 'development'}\n`);
console.log(`  ${pad('', 4)} ${pad('VARIABLE', 26)} ${pad('SCOPE', 15)} ${pad('SECRET', 7)} STATUS`);
console.log('  ' + '-'.repeat(96));
for (const r of rows) {
  console.log(`  [${MARK[r.kind]}] ${pad(r.name, 26)} ${pad(r.scope, 15)} ${pad(r.secret, 7)} ${r.status}`);
  if (r.note) console.log(`         ${'↳'} ${r.note}`);
}
console.log('  ' + '-'.repeat(96));
console.log(`\n  BLOCKING issues : ${blocking}`);
console.log(`  advisories     : ${advisories}`);

if (!PROD) {
  console.log('\n  (development mode — run with --strict to evaluate production rules)');
}
console.log(
  '\n  Reminder: RESEND domain SPF/DKIM verification, Render dashboard config, DNS/HTTPS,' +
    '\n  S3 bucket policy + a real upload/read/delete test, and off-container backup storage' +
    '\n  are OPERATIONAL items this script cannot verify. See docs/DATABASE-RECOVERY.md and DEPLOY.md.\n'
);

process.exit(blocking > 0 && PROD ? 1 : 0);
