import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductsContext';
import usePageMeta from '../hooks/usePageMeta';
import ProductGallery from '../components/ProductGallery';
import ProductGrid from '../components/ProductGrid';
import PdpDrawer from '../components/PdpDrawer';
import './ProductDetail.css';

const eur = (n) => `€${Number(n || 0).toLocaleString('en-IE', { maximumFractionDigits: 0 })}`;

const ProductDetail = () => {
  const { id } = useParams();
  const { products, loading } = useProducts();
  const { addToCart } = useCart();

  const product = useMemo(
    () => products.find((p) => String(p.id) === String(id)),
    [products, id]
  );

  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [added, setAdded] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const [drawer, setDrawer] = useState(null); // 'details' | 'sizing' | 'shipping'
  const buyRef = useRef(null);

  usePageMeta(product ? product.name : 'Product', product ? product.description : undefined);

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

  if (loading && !products.length) {
    return (
      <div className="pd">
        <div className="pd__grid">
          <div className="skeleton" style={{ aspectRatio: '3 / 4' }} />
          <div className="pd__info"><div className="skeleton" style={{ height: 260, margin: '2rem' }} /></div>
        </div>
      </div>
    );
  }

  if (!product) {
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
    if (needsSize && !size) { setSizeError(true); return; }
    setSizeError(false);
    addToCart(product, needsSize ? size : '', qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 3500);
  };

  const related = products.filter((p) => p.id !== product.id).slice(0, 4);

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
                <div className="pd__size-row">
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
                <p className="pd__size-note" aria-live="polite">
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
