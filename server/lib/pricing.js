'use strict';

const { AppError } = require('./errors');
const { SHIPPING_RATES_CENTS, TAX_RATE_BPS, CURRENCY } = require('../config');

/**
 * Authoritative, server-side order total calculation.
 *
 * Inputs:
 *   validatedItems : [{ productId, size, quantity }]        (from validation.js)
 *   productsById    : Map<number, { id, price_cents, status, title, track_inventory, stock, sizes }>
 *   country        : ISO-2 country code (already checked as supported)
 *
 * Rules:
 *   subtotal  = Σ (DB unit price_cents * quantity)          — client price ignored
 *   shipping  = SHIPPING_RATES_CENTS[country]               — client shipping ignored
 *   discount  = 0                                           — no server promo model yet
 *   tax       = round(subtotal * TAX_RATE_BPS / 10000)      — 0 unless configured
 *   total     = subtotal + shipping - discount + tax
 *
 * Throws AppError (safe message) for any product/size problem.
 */
function computeOrderTotals({ validatedItems, productsById, country }) {
  if (!SHIPPING_RATES_CENTS[country]) {
    throw new AppError('unsupported_country', 'Shipping is not available to that country.', 400);
  }

  const lines = validatedItems.map((item) => {
    const product = productsById.get(item.productId);
    if (!product) {
      throw new AppError('product_unavailable', 'One of the items is no longer available.', 409);
    }
    if (product.status !== 'published') {
      throw new AppError('product_unavailable', `"${product.title}" is not available for purchase.`, 409);
    }

    const configuredSizes = Array.isArray(product.sizes) ? product.sizes.map(String) : [];
    if (configuredSizes.length > 0) {
      if (!item.size || !configuredSizes.includes(String(item.size))) {
        throw new AppError('invalid_size', `Please choose a valid size for "${product.title}".`, 400);
      }
    }

    const unitPriceCents = Number(product.price_cents);
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
      throw new AppError('pricing_error', 'We could not price one of the items. Please try again.', 500);
    }

    const lineTotalCents = unitPriceCents * item.quantity;
    return {
      productId: product.id,
      name: product.title,
      size: item.size || '',
      quantity: item.quantity,
      unitPriceCents,
      lineTotalCents,
    };
  });

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const shippingCents = SHIPPING_RATES_CENTS[country];
  const discountCents = 0; // no authoritative server-side promotion model yet
  const taxCents = TAX_RATE_BPS > 0 ? Math.round((subtotalCents * TAX_RATE_BPS) / 10000) : 0;
  const totalCents = subtotalCents + shippingCents - discountCents + taxCents;

  if (totalCents < 0) {
    throw new AppError('pricing_error', 'Order total could not be calculated.', 500);
  }

  return {
    currency: CURRENCY,
    subtotalCents,
    shippingCents,
    discountCents,
    taxCents,
    totalCents,
    lines,
  };
}

module.exports = { computeOrderTotals };
