'use strict';

const { AppError } = require('./errors');
const {
  SUPPORTED_COUNTRIES,
  ALLOWED_PAYMENT_METHODS,
  PAYMENT_METHODS,
  ENABLE_COD,
} = require('../config');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-\s0-9]{6,20}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x1F\x7F]/g;

function str(value, { field, min = 1, max = 200, required = true } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') {
    throw new AppError('invalid_input', `${field} must be text.`, 400);
  }
  // Strip control chars, collapse whitespace, trim.
  const cleaned = value.replace(CONTROL_CHARS_RE, ' ').replace(/\s+/g, ' ').trim();
  if (required && cleaned.length < min) {
    throw new AppError('invalid_input', `${field} is required.`, 400);
  }
  if (cleaned.length > max) {
    throw new AppError('invalid_input', `${field} is too long.`, 400);
  }
  return cleaned;
}

function intInRange(value, { field, min, max }) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new AppError('invalid_input', `${field} must be an integer between ${min} and ${max}.`, 400);
  }
  return n;
}

function positiveIntId(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError('invalid_input', `${field} is invalid.`, 400);
  }
  return n;
}

/**
 * Validate + normalise the public order-creation payload.
 * Never trusts client price / total / shipping / discount / stock.
 * Returns only the fields the server is willing to act on.
 */
function validateOrderInput(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError('invalid_input', 'Order payload is missing.', 400);
  }

  const customerName = str(body.customerName, { field: 'Name', min: 2, max: 120 });
  const customerEmail = str(body.customerEmail, { field: 'Email', max: 160 }).toLowerCase();
  if (!EMAIL_RE.test(customerEmail)) {
    throw new AppError('invalid_input', 'A valid email address is required.', 400);
  }
  const phone = str(body.phone, { field: 'Phone', max: 20 });
  if (!PHONE_RE.test(phone)) {
    throw new AppError('invalid_input', 'A valid phone number is required.', 400);
  }

  const addr =
    body.shippingAddress && typeof body.shippingAddress === 'object' ? body.shippingAddress : {};
  const shippingAddress = {
    address: str(addr.address, { field: 'Address', min: 3, max: 200 }),
    city: str(addr.city, { field: 'City', min: 2, max: 100 }),
    state: str(addr.state, { field: 'State/Region', min: 0, max: 100, required: false }),
    postalCode: str(addr.postalCode, { field: 'Postal code', min: 2, max: 20 }),
  };

  const country = str(body.country, { field: 'Country', min: 2, max: 2 }).toUpperCase();
  if (!SUPPORTED_COUNTRIES.includes(country)) {
    throw new AppError(
      'unsupported_country',
      `We do not currently ship to that country. Supported: ${SUPPORTED_COUNTRIES.join(', ')}.`,
      400
    );
  }

  const paymentMethod = str(body.paymentMethod, { field: 'Payment method', max: 40 });
  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new AppError('invalid_payment_method', 'Unknown payment method.', 400);
  }
  if (paymentMethod === PAYMENT_METHODS.CASH_ON_DELIVERY && !ENABLE_COD) {
    throw new AppError('payment_method_disabled', 'Cash on delivery is not available.', 400);
  }

  const ALLOWED_SHIPPING_METHODS = ['standard', 'pickup'];
  const shippingMethodRaw =
    str(body.shippingMethod, { field: 'Shipping method', max: 40, required: false }) || 'standard';
  if (!ALLOWED_SHIPPING_METHODS.includes(shippingMethodRaw)) {
    throw new AppError('invalid_shipping_method', 'Unknown shipping method.', 400);
  }
  const shippingMethod = shippingMethodRaw;

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new AppError('invalid_input', 'Your cart is empty.', 400);
  }
  if (body.items.length > 50) {
    throw new AppError('invalid_input', 'Too many line items.', 400);
  }
  const items = body.items.map((raw, i) => {
    if (!raw || typeof raw !== 'object') {
      throw new AppError('invalid_input', `Cart line ${i + 1} is malformed.`, 400);
    }
    return {
      productId: positiveIntId(raw.id ?? raw.productId, `Cart line ${i + 1} product`),
      size: str(raw.size, { field: `Cart line ${i + 1} size`, min: 0, max: 20, required: false }),
      quantity: intInRange(raw.quantity ?? 1, {
        field: `Cart line ${i + 1} quantity`,
        min: 1,
        max: 20,
      }),
    };
  });

  // client-supplied total is accepted for logging / reconciliation only.
  const clientTotalCents =
    body.total !== undefined && Number.isFinite(Number(body.total))
      ? Math.round(Number(body.total) * 100)
      : null;

  return {
    customerName,
    customerEmail,
    phone,
    shippingAddress,
    country,
    paymentMethod,
    shippingMethod,
    items,
    clientTotalCents,
  };
}

module.exports = { validateOrderInput, str, intInRange, positiveIntId };
