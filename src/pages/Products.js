import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProducts } from '../context/ProductsContext';
import usePageMeta from '../hooks/usePageMeta';
import ProductGrid from '../components/ProductGrid';
import FilterDrawer from '../components/FilterDrawer';
import './Products.css';

const PAGE = 12;

const EMPTY = { category: '', sizes: [], price: '', inStockOnly: false };

const Products = () => {
  const { products, loading, error } = useProducts();
  const [params, setParams] = useSearchParams();

  const [filters, setFilters] = useState(EMPTY);
  const [drawer, setDrawer] = useState(false);
  const [sort, setSort] = useState(params.get('sort') || 'featured');
  const [visible, setVisible] = useState(PAGE);

  const query = (params.get('q') || '').trim().toLowerCase();

  // hydrate category / sort from the URL
  useEffect(() => {
    setFilters((f) => ({ ...f, category: params.get('category') || '' }));
    setSort(params.get('sort') || 'featured');
    setVisible(PAGE);
  }, [params]);

  const allCategories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );
  const allSizes = useMemo(
    () => [...new Set(products.flatMap((p) => p.sizes || []))].sort((a, b) => Number(a) - Number(b)),
    [products]
  );

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (query && !`${p.name} ${p.category} ${p.sku}`.toLowerCase().includes(query)) return false;
      if (filters.category && p.category?.toLowerCase() !== filters.category.toLowerCase()) return false;
      if (filters.sizes.length && !filters.sizes.some((s) => (p.sizes || []).includes(s))) return false;
      if (filters.inStockOnly && p.inStock === false) return false;
      if (filters.price) {
        const [lo, hi] = filters.price.split('-').map(Number);
        if (p.price < lo || p.price >= hi) return false;
      }
      return true;
    });
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === 'new') list = [...list].sort((a, b) => Number(b.newArrival) - Number(a.newArrival));
    else list = [...list].sort((a, b) => Number(b.featured) - Number(a.featured));
    return list;
  }, [products, query, filters, sort]);

  usePageMeta(
    filters.category ? `${filters.category}` : query ? `Search — ${query}` : 'The Collection',
    `Shop BUKUR WORLD heels${filters.category ? ` — ${filters.category}` : ''}. Sculptural silhouettes, made in Prishtina.`
  );

  const updateSort = (value) => {
    setSort(value);
    const next = new URLSearchParams(params);
    if (value === 'featured') next.delete('sort'); else next.set('sort', value);
    setParams(next, { replace: true });
  };
  const updateFilters = (next) => {
    setFilters(next);
    setVisible(PAGE);
    const p = new URLSearchParams(params);
    if (next.category) p.set('category', next.category); else p.delete('category');
    setParams(p, { replace: true });
  };
  const reset = () => {
    setFilters(EMPTY);
    const p = new URLSearchParams(params);
    p.delete('category');
    setParams(p, { replace: true });
  };

  const heading = filters.category || (query ? `“${query}”` : 'All heels');
  const activeCount =
    (filters.category ? 1 : 0) + filters.sizes.length + (filters.price ? 1 : 0) + (filters.inStockOnly ? 1 : 0);

  return (
    <div className="collection">
      <div className="container">
        <header className="collection__head">
          <p className="u-eyebrow">The Collection</p>
          <h1 className="u-display">{heading}</h1>
          <p className="u-fine">{filtered.length} {filtered.length === 1 ? 'style' : 'styles'}</p>
        </header>

        <div className="collection__toolbar">
          <button className="collection__filter-btn" onClick={() => setDrawer(true)}>
            Filter{activeCount ? ` (${activeCount})` : ''}
          </button>
          <label className="collection__sort">
            <span className="sr-only">Sort by</span>
            <select value={sort} onChange={(e) => updateSort(e.target.value)}>
              <option value="featured">Sort — Featured</option>
              <option value="new">Sort — Newest</option>
              <option value="price-asc">Sort — Price, low to high</option>
              <option value="price-desc">Sort — Price, high to low</option>
            </select>
          </label>
        </div>

        {loading && !products.length ? (
          <div className="pgrid">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton sk-card" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="state">
            <p className="u-eyebrow">Nothing here yet</p>
            <h2 className="u-title">No styles match this selection</h2>
            <p className="u-lede" style={{ marginInline: 'auto', textAlign: 'center' }}>
              Try removing a filter, or explore the full collection.
            </p>
            <button className="btn btn--ghost btn--sm" onClick={reset} style={{ justifySelf: 'center' }}>
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <ProductGrid products={filtered.slice(0, visible)} cols={3} priorityCount={3} />
            {visible < filtered.length && (
              <div className="collection__more">
                <button className="btn btn--ghost" onClick={() => setVisible((v) => v + PAGE)}>
                  Load more
                </button>
              </div>
            )}
          </>
        )}

        {error && !products.length && (
          <p className="u-fine" style={{ marginTop: '2rem' }}>
            Showing a preview selection — <Link to="/products" className="link-quiet link-underline">retry</Link>.
          </p>
        )}
      </div>

      <FilterDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        categories={allCategories}
        sizes={allSizes}
        value={filters}
        onChange={updateFilters}
        onReset={reset}
        resultCount={filtered.length}
      />
    </div>
  );
};

export default Products;
