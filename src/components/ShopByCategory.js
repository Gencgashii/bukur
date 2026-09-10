import React from 'react';
import { Link } from 'react-router-dom';
import useReveal from '../hooks/useReveal';
import Img from './Img';

/**
 * "Shop by silhouette".
 *
 * Prefers an explicit editorial `categories` list ([{ name, image }]) so the
 * imagery is art-directed and STABLE — it does not shift when products change.
 * If none is supplied it falls back to deriving one representative image per
 * category from the loaded product data.
 */
const FALLBACK_IMAGE = '/media/lookbook-daylight.jpg';

const ShopByCategory = ({ categories, products = [] }) => {
  const ref = useReveal();

  let cats = Array.isArray(categories) && categories.length
    ? categories.map((c) => [c.name, c.image || FALLBACK_IMAGE, Boolean(c.dim)])
    : null;

  if (!cats) {
    const seen = new Map();
    for (const p of products) {
      if (!p.category || seen.has(p.category)) continue;
      seen.set(p.category, [p.images?.[0] || p.image || FALLBACK_IMAGE, false]);
    }
    cats = [...seen.entries()].map(([name, [img, dim]]) => [name, img, dim]);
  }

  if (!cats.length) return null;

  return (
    <section ref={ref} className="section reveal">
      <div className="container">
        <div className="section-head">
          <div className="section-head__title">
            <p className="u-eyebrow">The Edits</p>
            <h2 className="u-title">Shop by mood</h2>
          </div>
          <Link to="/products" className="link-underline link-quiet">All heels</Link>
        </div>
      </div>
      <div className="cats">
        {cats.map(([name, img, dim]) => (
          <Link
            key={name}
            to={`/products?category=${encodeURIComponent(name)}`}
            className={`cat${dim ? ' cat--dim' : ''}`}
          >
            <Img src={img} alt={`${name} — BUKUR WORLD`} sizes="(max-width: 760px) 100vw, 25vw" fill />
            <span className="cat__label">{name}<small>Discover</small></span>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default ShopByCategory;
