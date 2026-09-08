'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { AppError } = require('../lib/errors');
const { safeEqual } = require('../lib/cookies');

const AUTH_COOKIE = 'bukur_admin';
const CSRF_COOKIE = 'bukur_csrf';
const CSRF_HEADER = 'x-csrf-token';

// 12h default, matched to the JWT lifetime.
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

function signToken(admin) {
  return jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

function newCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function cookieBase() {
  const sameSite = config.ADMIN_COOKIE_SAMESITE; // 'lax' | 'strict' | 'none'
  return {
    path: '/',
    sameSite,
    // Browsers require Secure whenever SameSite=None; also always Secure in prod.
    secure: config.IS_PROD || sameSite === 'none',
    maxAge: MAX_AGE_MS,
  };
}

/**
 * Set the auth + CSRF cookies. JWT cookie is HttpOnly (invisible to JS);
 * CSRF cookie is readable by the admin SPA so it can echo it in a header
 * (double-submit-cookie pattern).
 */
function setAuthCookies(res, admin) {
  const csrf = newCsrfToken();
  res.cookie(AUTH_COOKIE, signToken(admin), { ...cookieBase(), httpOnly: true });
  res.cookie(CSRF_COOKIE, csrf, { ...cookieBase(), httpOnly: false });
  return csrf;
}

function clearAuthCookies(res) {
  const sameSite = config.ADMIN_COOKIE_SAMESITE;
  const opts = { path: '/', sameSite, secure: config.IS_PROD || sameSite === 'none' };
  res.clearCookie(AUTH_COOKIE, { ...opts, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...opts, httpOnly: false });
}

/**
 * Authn + authz. Accepts the HttpOnly cookie (browser) OR an
 * `Authorization: Bearer` token (server-to-server tooling / tests). Both
 * require a valid signature and role === 'admin'.
 */
function requireAdmin(req, _res, next) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const cookie = (req.cookies && req.cookies[AUTH_COOKIE]) || '';
  const token = cookie || bearer;
  if (!token) return next(new AppError('unauthorized', 'Authentication required.', 401));
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    if (payload.role !== 'admin') {
      return next(new AppError('forbidden', 'Admin access required.', 403));
    }
    req.admin = payload;
    req.adminAuthVia = cookie ? 'cookie' : 'bearer';
    return next();
  } catch {
    return next(new AppError('unauthorized', 'Session expired. Please sign in again.', 401));
  }
}

/**
 * CSRF guard for state-changing requests made with the cookie (browser).
 * Double-submit: the `X-CSRF-Token` header must equal the `bukur_csrf` cookie.
 * Requests authenticated by Bearer (no cookie) are exempt — they are not
 * subject to browser CSRF and are used only by trusted tooling/tests.
 */
function requireCsrf(req, _res, next) {
  if (req.adminAuthVia === 'bearer') return next();
  const cookie = (req.cookies && req.cookies[CSRF_COOKIE]) || '';
  const header = req.get(CSRF_HEADER) || '';
  if (!cookie || !header || !safeEqual(cookie, header)) {
    return next(new AppError('csrf_failed', 'Invalid or missing CSRF token.', 403));
  }
  return next();
}

module.exports = {
  AUTH_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  signToken,
  newCsrfToken,
  setAuthCookies,
  clearAuthCookies,
  requireAdmin,
  requireCsrf,
};
