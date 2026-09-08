'use strict';

const config = require('../config');

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `product-${Date.now()}`;

const orderNumber = (id) => `BK-${String(id).padStart(6, '0')}`;

// Products query used by both storefront and admin. New columns are additive
// and come through `p.*`.
const productSelect = `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

/** Normalise the stored images JSONB into an ordered array of { url, position }. */
function productImages(row) {
  const raw = Array.isArray(row.images) ? row.images : [];
  const cleaned = raw
    .map((im, i) => ({
      url: typeof im === 'string' ? im : String(im?.url || ''),
      position: Number.isFinite(Number(im?.position)) ? Number(im.position) : i,
    }))
    .filter((im) => im.url)
    .sort((a, b) => a.position - b.position);
  if (cleaned.length) return cleaned;
  return row.image_url ? [{ url: row.image_url, position: 0 }] : [];
}

/** Shape returned to the storefront AND the admin dashboard. */
const serializeProduct = (row) => {
  const images = productImages(row);
  const primary = images[0]?.url || row.image_url || '';
  return {
    id: row.id,
    title: row.title,
    name: row.title,
    handle: row.handle,
    sku: row.sku || '',
    description: row.description,
    status: row.status,
    archived: Boolean(row.archived),
    featured: Boolean(row.featured),
    newArrival: Boolean(row.new_arrival),
    active: row.status === 'published' && !row.archived,
    thumbnail: primary,
    image: primary,
    images: images.map((im) => ({ url: im.url })),
    imageList: images,
    category: row.category_name ? { id: row.category_id, name: row.category_name } : null,
    categories: row.category_name ? [{ id: row.category_id, name: row.category_name }] : [],
    categoryId: row.category_id || null,
    stock: row.stock,
    trackInventory: Boolean(row.track_inventory),
    lowStockThreshold: row.low_stock_threshold ?? 3,
    lowStock: Boolean(row.track_inventory) && Number(row.stock) <= Number(row.low_stock_threshold ?? 3),
    sizes: Array.isArray(row.sizes) ? row.sizes.map(String) : [],
    priceCents: row.price_cents,
    currency: config.CURRENCY,
    variants: [{ prices: [{ amount: row.price_cents, currency_code: config.CURRENCY }] }],
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
};

/** Never exposes card data — payments table only ever stores a provider reference. */
const serializePayment = (p) => ({
  id: p.id,
  orderId: p.order_id,
  orderNumber: orderNumber(p.order_id),
  method: p.method,
  provider: p.provider,
  status: p.status,
  amountCents: p.amount_cents,
  currency: p.currency,
  providerReference: p.provider_reference || '',
  errorCode: p.error_code || '',
  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

const serializeOrder = (o, items = [], pays = []) => ({
  id: o.id,
  number: orderNumber(o.id),
  createdAt: o.created_at,
  updatedAt: o.updated_at,
  customer: { name: o.customer_name, email: o.customer_email, phone: o.phone },
  shippingAddress: o.shipping_address || {},
  country: o.country || '',
  shippingMethod: o.shipping_method || 'standard',
  paymentMethod: o.payment_method,
  paymentStatus: o.payment_status,
  fulfillmentStatus: o.fulfillment_status,
  confirmationEmail: {
    status: o.confirmation_email_status || 'pending',
    sentAt: o.confirmation_email_sent_at || null,
    attempts: o.confirmation_email_attempts || 0,
    error: o.confirmation_email_error || '',
  },
  totals: {
    currency: o.currency,
    subtotalCents: o.subtotal_cents,
    shippingCents: o.shipping_cents,
    discountCents: o.discount_cents,
    taxCents: o.tax_cents,
    totalCents: o.total_cents,
    clientTotalCents: o.client_total_cents,
  },
  items: items.map((it) => ({
    id: it.id,
    productId: it.product_id,
    name: it.name,
    size: it.size || '',
    quantity: it.quantity,
    unitPriceCents: it.price_cents,
    subtotalCents: it.price_cents * it.quantity,
  })),
  payments: pays.map(serializePayment),
});

module.exports = {
  slugify,
  orderNumber,
  productSelect,
  productImages,
  serializeProduct,
  serializeOrder,
  serializePayment,
};
