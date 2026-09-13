'use strict';

const { str } = require('./validation');

/**
 * Pure query-building for the public product list — no I/O. Kept separate
 * from server/index.js so the FILTER -> SORT -> PAGINATE contract can be
 * unit-tested directly instead of only through a live HTTP+DB round-trip.
 */

const PRODUCTS_DEFAULT_LIMIT = 12;
const PRODUCTS_MAX_LIMIT = 48;

const PRODUCT_SORTS = {
  featured: 'p.featured DESC, p.created_at DESC',
  new: 'p.new_arrival DESC, p.created_at DESC',
  'price-asc': 'p.price_cents ASC, p.id ASC',
  'price-desc': 'p.price_cents DESC, p.id ASC',
};

/** Normalises + validates raw `req.query` into a typed filter/sort/page object. */
function parseProductListQuery(q) {
  const page = Math.max(Number(q.page) || 1, 1);
  const limit = Math.min(Math.max(Number(q.limit) || PRODUCTS_DEFAULT_LIMIT, 1), PRODUCTS_MAX_LIMIT);
  const sort = PRODUCT_SORTS[q.sort] ? q.sort : 'featured';
  const category = str(q.category, { field: 'category', max: 80, required: false });
  const sizes = str(q.sizes, { field: 'sizes', max: 100, required: false })
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const search = str(q.q, { field: 'search', max: 120, required: false });
  const inStockOnly = q.inStockOnly === 'true' || q.inStockOnly === '1';
  // "lo-hi" in EUROS (matches the storefront's existing filter chips), converted to cents.
  let priceMinCents = null;
  let priceMaxCents = null;
  if (typeof q.price === 'string' && q.price.includes('-')) {
    const [lo, hi] = q.price.split('-').map(Number);
    if (Number.isFinite(lo)) priceMinCents = Math.round(lo * 100);
    if (Number.isFinite(hi)) priceMaxCents = Math.round(hi * 100);
  }
  return { page, limit, sort, category, sizes, search, inStockOnly, priceMinCents, priceMaxCents };
}

/**
 * Shared WHERE-clause builder so the list query and the facets query never
 * drift apart. Mutates `params` (pushes values) and returns the SQL string.
 * Every value is parameterized — nothing here is ever string-concatenated
 * into the SQL text.
 */
function buildProductFilterSql({ category, sizes, search, inStockOnly, priceMinCents, priceMaxCents }, params) {
  const where = [`p.status = 'published'`, `NOT p.archived`];
  if (category) {
    params.push(category);
    where.push(`LOWER(c.name) = LOWER($${params.length})`);
  }
  if (sizes.length) {
    params.push(sizes);
    where.push(`p.sizes ?| $${params.length}::text[]`);
  }
  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    where.push(`(p.title ILIKE $${i} OR c.name ILIKE $${i} OR p.sku ILIKE $${i})`);
  }
  if (inStockOnly) {
    where.push(`(NOT p.track_inventory OR p.stock > 0)`);
  }
  if (priceMinCents !== null) {
    params.push(priceMinCents);
    where.push(`p.price_cents >= $${params.length}`);
  }
  if (priceMaxCents !== null) {
    params.push(priceMaxCents);
    where.push(`p.price_cents < $${params.length}`);
  }
  return where.join(' AND ');
}

module.exports = {
  PRODUCTS_DEFAULT_LIMIT,
  PRODUCTS_MAX_LIMIT,
  PRODUCT_SORTS,
  parseProductListQuery,
  buildProductFilterSql,
};
