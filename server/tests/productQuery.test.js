'use strict';

/**
 * Pure unit tests for the product list FILTER -> SORT -> PAGINATE contract
 * (no DB, no network). Run:  node --test server/tests/productQuery.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PRODUCTS_DEFAULT_LIMIT,
  PRODUCTS_MAX_LIMIT,
  PRODUCT_SORTS,
  parseProductListQuery,
  buildProductFilterSql,
} = require('../lib/productQuery');

test('parseProductListQuery: defaults when query is empty', () => {
  const q = parseProductListQuery({});
  assert.equal(q.page, 1);
  assert.equal(q.limit, PRODUCTS_DEFAULT_LIMIT);
  assert.equal(q.sort, 'featured');
  assert.equal(q.category, '');
  assert.deepEqual(q.sizes, []);
  assert.equal(q.search, '');
  assert.equal(q.inStockOnly, false);
  assert.equal(q.priceMinCents, null);
  assert.equal(q.priceMaxCents, null);
});

test('parseProductListQuery: page/limit are coerced and clamped', () => {
  assert.equal(parseProductListQuery({ page: '0' }).page, 1);
  assert.equal(parseProductListQuery({ page: '-5' }).page, 1);
  assert.equal(parseProductListQuery({ page: '3' }).page, 3);
  assert.equal(parseProductListQuery({ page: 'nope' }).page, 1);

  // `0` is falsy, so it hits the `|| PRODUCTS_DEFAULT_LIMIT` fallback (same as
  // an unparseable value) rather than being clamped like a negative number.
  assert.equal(parseProductListQuery({ limit: '0' }).limit, PRODUCTS_DEFAULT_LIMIT);
  assert.equal(parseProductListQuery({ limit: '-10' }).limit, 1);
  assert.equal(parseProductListQuery({ limit: String(PRODUCTS_MAX_LIMIT + 100) }).limit, PRODUCTS_MAX_LIMIT);
  assert.equal(parseProductListQuery({ limit: 'nope' }).limit, PRODUCTS_DEFAULT_LIMIT);
});

test('parseProductListQuery: unknown sort falls back to featured', () => {
  assert.equal(parseProductListQuery({ sort: 'bogus' }).sort, 'featured');
  Object.keys(PRODUCT_SORTS).forEach((key) => {
    assert.equal(parseProductListQuery({ sort: key }).sort, key);
  });
});

test('parseProductListQuery: sizes are split, trimmed, deduped-by-cap at 20', () => {
  const q = parseProductListQuery({ sizes: ' 38, 39 ,,40 ' });
  assert.deepEqual(q.sizes, ['38', '39', '40']);

  const many = Array.from({ length: 30 }, (_, i) => String(i)).join(',');
  assert.equal(parseProductListQuery({ sizes: many }).sizes.length, 20);
});

test('parseProductListQuery: price range "lo-hi" euros converts to integer cents', () => {
  const q = parseProductListQuery({ price: '50-150' });
  assert.equal(q.priceMinCents, 5000);
  assert.equal(q.priceMaxCents, 15000);
});

test('parseProductListQuery: malformed price range leaves bounds null', () => {
  const q = parseProductListQuery({ price: 'not-a-range' });
  assert.equal(q.priceMinCents, null);
  assert.equal(q.priceMaxCents, null);
});

test('parseProductListQuery: inStockOnly accepts "true" or "1" only', () => {
  assert.equal(parseProductListQuery({ inStockOnly: 'true' }).inStockOnly, true);
  assert.equal(parseProductListQuery({ inStockOnly: '1' }).inStockOnly, true);
  assert.equal(parseProductListQuery({ inStockOnly: 'false' }).inStockOnly, false);
  assert.equal(parseProductListQuery({ inStockOnly: '' }).inStockOnly, false);
});

test('buildProductFilterSql: base case is always published + not archived', () => {
  const params = [];
  const sql = buildProductFilterSql(parseProductListQuery({}), params);
  assert.equal(sql, `p.status = 'published' AND NOT p.archived`);
  assert.deepEqual(params, []);
});

test('buildProductFilterSql: every value is parameterized, never inlined', () => {
  const params = [];
  const filters = parseProductListQuery({
    category: "Robert'); DROP TABLE products;--",
    sizes: '38,39',
    q: 'heel',
    inStockOnly: 'true',
    price: '10-20',
  });
  const sql = buildProductFilterSql(filters, params);

  // The raw category string must never appear literally in the SQL text.
  assert.equal(sql.includes('DROP TABLE'), false);
  // Every clause referencing user input must use a $n placeholder.
  assert.match(sql, /LOWER\(c\.name\) = LOWER\(\$1\)/);
  assert.match(sql, /p\.sizes \?\| \$2::text\[\]/);
  assert.match(sql, /p\.title ILIKE \$3/);
  assert.match(sql, /p\.price_cents >= \$4/);
  assert.match(sql, /p\.price_cents < \$5/);
  assert.match(sql, /\(NOT p\.track_inventory OR p\.stock > 0\)/);

  // The dangerous string only ever appears as a bound parameter value.
  assert.equal(params[0], "Robert'); DROP TABLE products;--");
  assert.deepEqual(params[1], ['38', '39']);
  assert.equal(params[2], '%heel%');
  assert.equal(params[3], 1000);
  assert.equal(params[4], 2000);
});

test('buildProductFilterSql: appends to an existing params array without clobbering prior placeholders', () => {
  const params = ['already-here'];
  const sql = buildProductFilterSql(parseProductListQuery({ category: 'Icon' }), params);
  assert.match(sql, /LOWER\(c\.name\) = LOWER\(\$2\)/);
  assert.deepEqual(params, ['already-here', 'Icon']);
});

test('buildProductFilterSql: omits clauses for filters that are not set', () => {
  const params = [];
  const sql = buildProductFilterSql(parseProductListQuery({ inStockOnly: 'true' }), params);
  assert.equal(sql, `p.status = 'published' AND NOT p.archived AND (NOT p.track_inventory OR p.stock > 0)`);
  assert.deepEqual(params, []);
});
