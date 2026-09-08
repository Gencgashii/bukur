'use strict';

const crypto = require('crypto');

/** Parse a Cookie header into an object. No dependency. */
function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string' || !header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (!key) continue;
    let val = part.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

/** Express middleware: populate req.cookies from the Cookie header. */
function cookieParser() {
  return (req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    next();
  };
}

/** Timing-safe string compare. */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

module.exports = { parseCookies, cookieParser, safeEqual };
