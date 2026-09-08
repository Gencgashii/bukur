import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductsContext';
import usePageMeta from '../hooks/usePageMeta';
import ProductGallery from '../components/ProductGallery';
import ProductGrid from '../components/ProductGrid';
import './ProductDetail.css';

const eur = (n) => `€${Number(n || 0).toLocaleString('en-IE', { maximumFractionDigits: 0 })}`;

const Accordion = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`pd-acc ${open ? 'is-open' : ''}`}>
      <button className="pd-acc__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{title}</span>
        <span className="pd-acc__sign" aria-hidden="true">{open ? '–' : '+'}</span>
      </button>
      {open && <div className="pd-acc__body">{children}</div>}
    </div>
  );
};

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

  usePageMeta(product ? product.name : 'Product', product ? product.description : undefined);

  if (loading && !products.length) {
    return (
      <div className="pd">
        <div className="pd__grid container">
          <div className="skeleton" style={{ aspectRatio: '4 / 5' }} />
          <div className="pd__info"><div className="skeleton" style={{ height: 260 }} /></div>
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

  const related = products.filter((p) => p.id !== product.id).slice(0, 3);

  return (
    <div className="pd">
      <div className="pd__grid container">
        <div className="pd__gallery">
          <ProductGallery images={product.images} alt={product.name} />
        </div>

        <div className="pd__info">
          <div className="pd__sticky">
            <Link to="/products" className="pd__back">← The Collection</Link>
            <p className="u-eyebrow" style={{ marginTop: '1.25rem' }}>{product.category}</p>
            <h1 className="pd__name">{product.name}</h1>
            <p className="pd__price">{eur(product.price)}</p>
            {product.description && <p className="pd__desc">{product.description}</p>}

            {needsSize ? (
              <div className="pd__sizes">
                <div className="pd__sizes-head">
                  <span className="u-fine">Size (EU)</span>
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
                  {sizeError ? 'Please choose a size to continue.' : size ? `Selected: EU ${size}` : 'Select your size'}
                </p>
              </div>
            ) : (
              <p className="pd__size-note" style={{ marginTop: '1.75rem' }}>Sizes for this style will be available shortly.</p>
            )}

            <div className="pd__buy">
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

            <div className="pd__accs">
              <Accordion title="Details" defaultOpen>
                <p>{product.description}</p>
                {product.sku && <p className="u-fine" style={{ marginTop: '0.75rem' }}>Style {product.sku}</p>}
              </Accordion>
              <Accordion title="Sizing &amp; fit">
                <p>BUKUR heels run true to size. If you are between sizes, we recommend taking the smaller size. The ankle strap is adjustable.</p>
              </Accordion>
              <Accordion title="Shipping &amp; returns">
                <p>Complimentary delivery across Kosovo and the region. Orders are dispatched in 1–3 business days. Returns accepted within 14 days in original condition.</p>
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <h2 className="u-title">You may also like</h2>
              <Link to="/products" className="link-underline link-quiet">All heels</Link>
            </div>
            <ProductGrid products={related} cols={3} />
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetail;
