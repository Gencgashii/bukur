import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import { API_URL } from '../config';
import { normalizeApiProduct } from '../lib/normalizeProduct';
import { products as fallbackProducts } from '../data/products';
import ProductGrid from '../components/ProductGrid';
import FilterDrawer from '../components/FilterDrawer';
import './Products.css';

const apiBase = API_URL.replace(/\/$/, '');
const PAGE_SIZE = 12;

const filtersFromParams = (params) => ({
  category: params.get('category') || '',
  sizes: (params.get('sizes') || '').split(',').filter(Boolean),
  price: params.get('price') || '',
  inStockOnly: params.get('inStockOnly') === 'true',
});

/** Server does FILTER -> SORT -> PAGINATE; this just mirrors that contract in the query string. */
function buildProductsQs({ filters, sort, query, page }) {
  const p = new URLSearchParams();
  p.set('page', String(page));
  p.set('limit', String(PAGE_SIZE));
  if (sort && sort !== 'featured') p.set('sort', sort);
  if (filters.category) p.set('category', filters.category);
  if (filters.sizes.length) p.set('sizes', filters.sizes.join(','));
  if (filters.price) p.set('price', filters.price);
  if (filters.inStockOnly) p.set('inStockOnly', 'true');
  if (query) p.set('q', query);
  return p.toString();
}

async function fetchProductsPage(state, signal) {
  const res = await fetch(`${apiBase}/store/products?${buildProductsQs(state)}`, { signal });
  if (!res.ok) throw new Error('Could not load products.');
  const data = await res.json();
  return {
    products: (data.products || []).map(normalizeApiProduct),
    pagination: data.pagination || { page: state.page, limit: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false },
  };
}

const dedupeById = (existing, incoming) => {
  const seen = new Set(existing.map((p) => p.id));
  return existing.concat(incoming.filter((p) => !seen.has(p.id)));
};

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = filtersFromParams(searchParams);
  const sort = searchParams.get('sort') || 'featured';
  const query = (searchParams.get('q') || '').trim().toLowerCase();

  const [items, setItems] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false });
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [loadMoreStatus, setLoadMoreStatus] = useState('idle'); // 'idle' | 'loading' | 'error'
  const [usingFallback, setUsingFallback] = useState(false);
  const [facets, setFacets] = useState({ categories: [], sizes: [] });
  const [liveMessage, setLiveMessage] = useState('');
  const [drawer, setDrawer] = useState(false);

  const abortRef = useRef(null);
  const reqIdRef = useRef(0);

  // Filter facet options come from the whole published catalog, independent
  // of whichever page happens to be loaded — fetched once, not derived from
  // `items` (which would otherwise only ever reflect the current page/filter).
  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/store/product-filters`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !cancelled) setFacets({ categories: d.categories || [], sizes: d.sizes || [] }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Runs whenever the filter/sort/search "identity" changes — i.e. everything
  // EXCEPT the page number, which Load More owns. Whenever this runs with the
  // URL already carrying `page > 1` — a fresh load/refresh/shared "loaded so
  // far" link, OR a Back/Forward navigation landing on a history entry Load
  // More created — sequentially hydrate pages 1..N instead of jumping straight
  // to a bare page N (which would show only that page's 12, not the
  // cumulative set the user actually had visible). A genuine filter/sort/
  // search change never hits this branch: updateFilters/updateSort/reset all
  // strip `page` from the URL themselves before pushing, so by the time this
  // effect sees the new identity there is no stale page to misinterpret.
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const myReqId = ++reqIdRef.current;

    const urlPage = Math.max(Number(searchParams.get('page')) || 1, 1);

    setStatus('loading');
    setLoadMoreStatus('idle');
    setUsingFallback(false);

    (async () => {
      try {
        if (urlPage > 1) {
          let acc = [];
          let lastPagination = null;
          for (let pg = 1; pg <= urlPage; pg += 1) {
            // eslint-disable-next-line no-await-in-loop
            const { products, pagination } = await fetchProductsPage(
              { filters, sort, query, page: pg },
              controller.signal
            );
            if (myReqId !== reqIdRef.current) return;
            acc = dedupeById(acc, products);
            lastPagination = pagination;
            if (!pagination.hasNextPage) break; // fewer pages exist than the URL claimed
          }
          setItems(acc);
          setPageInfo(lastPagination);
        } else {
          const { products, pagination } = await fetchProductsPage(
            { filters, sort, query, page: 1 },
            controller.signal
          );
          if (myReqId !== reqIdRef.current) return;
          setItems(products);
          setPageInfo(pagination);
          // A filter/sort/search change made any stale ?page= in the URL
          // meaningless — drop it rather than leave it pointing at the old set.
          if (searchParams.get('page')) {
            const next = new URLSearchParams(searchParams);
            next.delete('page');
            setSearchParams(next, { replace: true });
          }
        }
        setStatus('ready');
      } catch (err) {
        if (err.name === 'AbortError' || myReqId !== reqIdRef.current) return;
        setItems(fallbackProducts);
        setUsingFallback(true);
        setPageInfo({ page: 1, limit: PAGE_SIZE, total: fallbackProducts.length, totalPages: 1, hasNextPage: false });
        setStatus('error');
      }
    })();

    return () => controller.abort();
    // Re-run on every distinct filter/sort/search combination (NOT on page —
    // Load More owns that separately; `searchParams`/`setSearchParams` are
    // stable-enough router state, intentionally left out to avoid re-running
    // this effect from its own `setSearchParams` call above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.sizes.join(','), filters.price, filters.inStockOnly, sort, query]);

  const loadMore = useCallback(() => {
    if (loadMoreStatus === 'loading' || !pageInfo.hasNextPage) return;
    const nextPage = pageInfo.page + 1;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const myReqId = ++reqIdRef.current;
    setLoadMoreStatus('loading');

    fetchProductsPage({ filters, sort, query, page: nextPage }, controller.signal)
      .then(({ products: newOnes, pagination }) => {
        if (myReqId !== reqIdRef.current) return;
        setItems((prev) => dedupeById(prev, newOnes));
        setPageInfo(pagination);
        setLoadMoreStatus('idle');
        setLiveMessage(`${newOnes.length} more ${newOnes.length === 1 ? 'style' : 'styles'} loaded.`);
        const next = new URLSearchParams(searchParams);
        next.set('page', String(nextPage));
        setSearchParams(next, { replace: true });
      })
      .catch((err) => {
        if (err.name === 'AbortError' || myReqId !== reqIdRef.current) return;
        setLoadMoreStatus('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, query, pageInfo, loadMoreStatus, searchParams]);

  usePageMeta(
    filters.category ? `${filters.category}` : query ? `Search — ${query}` : 'The Collection',
    `Shop BUKUR WORLD heels${filters.category ? ` — ${filters.category}` : ''}. Sculptural silhouettes, made in Prishtina.`
  );

  const updateSort = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'featured') next.delete('sort'); else next.set('sort', value);
    next.delete('page');
    setSearchParams(next);
  };
  const updateFilters = (next) => {
    const p = new URLSearchParams(searchParams);
    if (next.category) p.set('category', next.category); else p.delete('category');
    if (next.sizes.length) p.set('sizes', next.sizes.join(',')); else p.delete('sizes');
    if (next.price) p.set('price', next.price); else p.delete('price');
    if (next.inStockOnly) p.set('inStockOnly', 'true'); else p.delete('inStockOnly');
    p.delete('page');
    setSearchParams(p);
  };
  const reset = () => {
    const p = new URLSearchParams(searchParams);
    ['category', 'sizes', 'price', 'inStockOnly', 'page'].forEach((k) => p.delete(k));
    setSearchParams(p);
  };

  const heading = filters.category || (query ? `“${query}”` : 'All heels');
  const activeCount =
    (filters.category ? 1 : 0) + filters.sizes.length + (filters.price ? 1 : 0) + (filters.inStockOnly ? 1 : 0);
  const resultCount = usingFallback ? items.length : pageInfo.total;

  return (
    <div className="collection">
      <div className="container">
        <header className="collection__head">
          <p className="u-eyebrow">The Collection</p>
          <h1 className="u-display">{heading}</h1>
          <p className="u-fine">{resultCount} {resultCount === 1 ? 'style' : 'styles'}</p>
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

        <div className="sr-only" role="status" aria-live="polite">{liveMessage}</div>

        {status === 'loading' && !items.length ? (
          <div className="pgrid pgrid--4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton sk-card" />)}
          </div>
        ) : items.length === 0 ? (
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
            <ProductGrid products={items} cols={4} priorityCount={4} />
            <div className="collection__more">
              {loadMoreStatus === 'error' ? (
                <div className="collection__more-status">
                  <p className="u-fine">Couldn’t load more styles.</p>
                  <button className="btn btn--ghost" onClick={loadMore}>Try again</button>
                </div>
              ) : usingFallback ? null : pageInfo.hasNextPage ? (
                <button
                  className="btn btn--ghost"
                  onClick={loadMore}
                  disabled={loadMoreStatus === 'loading'}
                  aria-busy={loadMoreStatus === 'loading'}
                >
                  {loadMoreStatus === 'loading' ? 'Loading…' : 'Load more'}
                </button>
              ) : items.length > PAGE_SIZE ? (
                <p className="u-fine collection__end">You’ve reached the end.</p>
              ) : null}
            </div>
          </>
        )}

        {usingFallback && (
          <p className="u-fine" style={{ marginTop: '2rem' }}>
            Showing a preview selection — <Link to="/products" className="link-quiet link-underline" onClick={() => window.location.reload()}>retry</Link>.
          </p>
        )}
      </div>

      <FilterDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        categories={facets.categories}
        sizes={facets.sizes}
        value={filters}
        onChange={updateFilters}
        onReset={reset}
        resultCount={resultCount}
      />
    </div>
  );
};

export default Products;
