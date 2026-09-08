import React from 'react';
import { Link } from 'react-router-dom';
import useReveal from '../hooks/useReveal';
import Img from './Img';

/**
 * "Shop by category" — only renders categories that actually exist in the
 * loaded product data. Picks a representative product image per category.
 */
const ShopByCategory = ({ products = [] }) => {
  const ref = useReveal();
  const seen = new Map();
  for (const p of products) {
    if (!p.category || seen.has(p.category)) continue;
    seen.set(p.category, p.images?.[0] || p.image || '/media/lookbook-daylight.jpg');
  }
  const cats = [...seen.entries()];
  if (!cats.length) return null;

  return (
    <section ref={ref} className="section reveal">
      <div className="container">
        <div className="section-head">
          <div className="section-head__title">
            <p className="u-eyebrow">The Wardrobe</p>
            <h2 className="u-title">Shop by silhouette</h2>
          </div>
          <Link to="/products" className="link-underline link-quiet">All heels</Link>
        </div>
      </div>
      <div className="cats">
        {cats.map(([name, img]) => (
          <Link key={name} to={`/products?category=${encodeURIComponent(name)}`} className="cat">
            <Img src={img} alt={`${name} — BUKUR WORLD`} sizes="(max-width: 760px) 100vw, 33vw" fill />
            <span className="cat__label">{name}<small>Discover</small></span>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default ShopByCategory;
