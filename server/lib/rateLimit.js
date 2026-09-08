'use strict';

const rateLimit = require('express-rate-limit');

const json = (message) => (req, res) =>
  res.status(429).json({ error: { code: 'rate_limited', message } });

// Sign-in / admin auth — strict, protects against credential stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many attempts. Please wait a few minutes and try again.'),
});

// Order creation — generous enough for real shoppers, blocks scripted abuse.
const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many order attempts. Please wait a moment and try again.'),
});

// Payment initiation / status polling.
const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many payment requests. Please wait a moment and try again.'),
});

// Generic mutation guard for other sensitive admin writes.
const adminWriteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many requests. Please slow down.'),
});

module.exports = { authLimiter, orderLimiter, paymentLimiter, adminWriteLimiter };
