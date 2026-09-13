import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { API_URL } from '../config';
import usePageMeta, { useJsonLd, SITE_ORIGIN } from '../hooks/usePageMeta';
import { track } from '../lib/analytics';
import ProductGallery from '../components/ProductGallery';
import ProductGrid from '../components/ProductGrid';
import PdpDrawer from '../components/PdpDrawer';
import { normalizeApiProduct } from '../lib/normalizeProduct';
import './ProductDetail.css';

const apiBase = API_URL.replace(/\/$/, '');
const eur = (n) => `€${Number(n || 0).toLocaleString('en-IE', { maximumFractionDigits: 0 })}`;

const ProductDetail = () => {
  const { id } = useParams();
  const { addToCart } = useCart();

  // The PDP looks up exactly one product by id — it never depends on
  // whichever page of the catalog happens to be loaded elsewhere in the app.
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [related, setRelated] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setProduct(null);
    setRelated([]);
    (async () => {
      try {
        const res = await fetch(`${apiBase}/store/products/${encodeURIComponent(id)}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('Could not load this product.');
        const data = await res.json();
        const normalized = normalizeApiProduct(data.product);
        if (cancelled) return;
        setProduct(normalized);
        if (normalized.category) {
          fetch(`${apiBase}/store/products?category=${encodeURIComponent(normalized.category)}&limit=5`)
            .then((r) => (r.ok ? r.json() : { products: [] }))
            .then((d) => {
              if (cancelled) return;
              const rel = (d.products || [])
                .map(normalizeApiProduct)
                .filter((p) => String(p.id) !== String(normalized.id))
                .slice(0, 4);
              setRelated(rel);
            })
            .catch(() => {});
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [sizeErrorPulse, setSizeErrorPulse] = useState(0);
  const [added, setAdded] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const [drawer, setDrawer] = useState(null); // 'details' | 'sizing' | 'shipping'
  const buyRef = useRef(null);

  usePageMeta(product ? product.name : 'Product', product ? product.description : undefined);

  const jsonLd = useMemo(() => {
    if (!product) return null;
    const abs = (u) => (typeof u === 'string' && /^https?:\/\//.test(u) ? u : `${SITE_ORIGIN}${u || ''}`);
    const priceEuros = product.priceCents != null ? product.priceCents / 100 : Number(product.price || 0);
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      ...(product.description ? { description: product.description } : {}),
      image: (product.images && product.images.length ? product.images : [product.image]).filter(Boolean).map(abs),
      ...(product.sku ? { sku: product.sku } : {}),
      brand: { '@type': 'Brand', name: 'BUKUR WORLD' },
      offers: {
        '@type': 'Offer',
        url: `${SITE_ORIGIN}/product/${product.id}`,
        priceCurrency: 'EUR',
        price: priceEuros.toFixed(2),
        availability:
          product.inStock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      },
    };
  }, [product]);
  useJsonLd(jsonLd);

  useEffect(() => {
    if (product) track('view_product', { id: product.id, name: product.name, price: product.price });
  }, [product]);

  useEffect(() => {
    const el = buyRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { rootMargin: '-80px 0px 0px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [product]);

  if (loading) {
    return (
      <div className="pd">
        <div className="pd__grid">
          <div className="skeleton" style={{ aspectRatio: '3 / 4' }} />
          <div className="pd__info"><div className="skeleton" style={{ height: 260, margin: '2rem' }} /></div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="state">
        <p className="u-eyebrow">Not found</p>
        <h1 className="u-title">This style has slipped away</h1>
        <p className="u-lede" style={{ marginInline: 'auto', textAlign: 'center' }}>
          It may have sold out or moved. Explore the rest of the collection.
        </p>
        <Link to="/products" className="btn btn--ghost btn--sm" style={{ justifySelf: 'center' }}>
          Back to the collection
        </Link>
      </div>
    );
  }

  const sizes = Array.isArray(product.sizes) ? product.sizes.map(String) : [];
  const needsSize = sizes.length > 0;
  const soldOut = product.inStock === false;

  const handleAdd = () => {
    if (needsSize && !size) {
      setSizeError(true);
      setSizeErrorPulse((n) => n + 1);
      return;
    }
    setSizeError(false);
    addToCart(product, needsSize ? size : '', qty);
    track('add_to_cart', { id: product.id, name: product.name, size: needsSize ? size : '', quantity: qty, price: product.price });
    setAdded(true);
    setTimeout(() => setAdded(false), 3500);
  };

  const META = [
    { key: 'details', label: 'Details' },
    { key: 'sizing', label: 'Sizing & fit' },
    { key: 'shipping', label: 'Shipping & returns' },
  ];

  return (
    <div className="pd">
      <div className="pd__grid">
        <div className="pd__gallery">
          <ProductGallery images={product.images} alt={product.name} />
        </div>

        <div className="pd__info">
          <div className="pd__sticky">
            <nav className="pd__crumbs" aria-label="Breadcrumb">
              <Link to="/products">The Collection</Link>
              {product.category && <><span aria-hidden="true">/</span><span>{product.category}</span></>}
            </nav>

            <h1 className="pd__name">{product.name}</h1>
            <p className="pd__price">{eur(product.price)}</p>
            {product.description && <p className="pd__desc">{product.description}</p>}

            {needsSize ? (
              <div className="pd__sizes">
                <div className="pd__sizes-head">
                  <span className="u-fine">Size — EU</span>
                  <span className="u-fine u-muted">{soldOut ? 'Sold out' : 'In stock'}</span>
                </div>
                <div key={`row-${sizeErrorPulse}`} className={`pd__size-row ${sizeError ? 'is-error' : ''}`}>
                  {sizes.map((s) => (
                    <button
                      key={s}
                      className={`pd__size ${size === s ? 'is-on' : ''}`}
                      onClick={() => { setSize(s); setSizeError(false); }}
                      aria-pressed={size === s}
                      disabled={soldOut}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p
                  key={`note-${sizeErrorPulse}`}
                  className={`pd__size-note ${sizeError ? 'is-error' : ''}`}
                  aria-live="polite"
                >
                  {sizeError ? 'Please choose a size to continue.' : size ? `Selected — EU ${size}` : 'Select your size'}
                </p>
              </div>
            ) : (
              <p className="pd__size-note" style={{ marginTop: '1.75rem' }}>Sizes for this style will be available shortly.</p>
            )}

            <div className="pd__buy" ref={buyRef}>
              <div className="pd__qty" aria-label="Quantity">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
                <span>{qty}</span>
                <button onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="Increase quantity">+</button>
              </div>
              <button className="btn btn--block" onClick={handleAdd} disabled={soldOut}>
                {soldOut ? 'Sold out' : 'Add to bag'}
              </button>
            </div>

            {added && (
              <p className="pd__added" role="status">
                Added to your bag. <Link to="/cart" className="link-underline">View bag</Link>
              </p>
            )}

            <div className="pd__meta">
              {META.map((m) => (
                <button key={m.key} className="pd__meta-row" onClick={() => setDrawer(m.key)}>
                  <span>{m.label}</span>
                  <span className="pd__meta-chevron" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* mobile sticky purchase bar */}
      <div className={`pd__stickybuy ${showSticky ? 'is-on' : ''}`} aria-hidden={!showSticky}>
        <div className="pd__stickybuy-inner container">
          <div className="pd__stickybuy-meta">
            <span className="pd__stickybuy-name">{product.name}</span>
            <span className="pd__stickybuy-price">{eur(product.price)}{size ? ` · EU ${size}` : ''}</span>
          </div>
          <button className="btn btn--sm" onClick={handleAdd} disabled={soldOut}>
            {soldOut ? 'Sold out' : 'Add to bag'}
          </button>
        </div>
      </div>

      <PdpDrawer open={drawer === 'details'} onClose={() => setDrawer(null)} title="Details">
        <p>{product.description}</p>
        {product.sku && <><h4>Style</h4><p>{product.sku}</p></>}
        <h4>The house</h4>
        <p>Designed in Prishtina and made in small runs. Satin, tulle and the openwork BUKUR heel, finished by hand.</p>
        <h4>Care</h4>
        <p>Store in the dust bag and box, away from heat and light. Wipe with a soft dry cloth.</p>
      </PdpDrawer>

      <PdpDrawer open={drawer === 'sizing'} onClose={() => setDrawer(null)} title="Sizing & fit">
        <p>BUKUR heels run true to size. If you are between sizes, take the smaller size. The ankle strap is adjustable.</p>
        <h4>Measurements</h4>
        <ul>
          <li>Heel height approx. 100 mm</li>
          <li>Pointed toe</li>
          <li>Leather sole</li>
        </ul>
      </PdpDrawer>

      <PdpDrawer open={drawer === 'shipping'} onClose={() => setDrawer(null)} title="Shipping & returns">
        <h4>Shipping</h4>
        <p>Complimentary delivery across Kosovo and the region. Orders are dispatched in 1–3 business days.</p>
        <h4>Returns</h4>
        <p>Returns accepted within 14 days of delivery, unworn and in original condition and packaging.</p>
        <p><Link to="/faq" className="link-underline">See full details</Link></p>
      </PdpDrawer>

      {related.length > 0 && (
        <section className="section pd__related">
          <div className="container">
            <div className="section-head">
              <p className="u-eyebrow">The Collection</p>
              <Link to="/products" className="link-underline link-quiet">All heels</Link>
            </div>
            <ProductGrid products={related} cols={4} />
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetail;
