import React from 'react';
import { Link } from 'react-router-dom';
import Img from './Img';
import './ProductCard.css';

const eur = (n) => `€${Number(n || 0).toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const CARD_SIZES = '(max-width: 380px) 92vw, (max-width: 760px) 46vw, (max-width: 1080px) 31vw, 24vw';

const ProductCard = ({ product, priority = false, index = 0 }) => {
  const images = product.images && product.images.length ? product.images : [product.image].filter(Boolean);
  const primary = images[0];
  const secondary = images[1];
  const soldOut = product.inStock === false;

  return (
    <Link
      to={`/product/${product.id}`}
      className="pcard"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="pcard__media">
        {primary && (
          <Img
            src={primary}
            alt={`${product.name} — BUKUR WORLD`}
            sizes={CARD_SIZES}
            priority={priority}
            fill
            className="pcard__img pcard__img--primary"
          />
        )}
        {secondary && (
          <Img
            src={secondary}
            alt=""
            aria-hidden="true"
            sizes={CARD_SIZES}
            fill
            className="pcard__img pcard__img--secondary"
          />
        )}
        {soldOut && <span className="pcard__tag pcard__tag--out">Sold out</span>}
        {!soldOut && product.newArrival && <span className="pcard__tag">New</span>}
        <span className="pcard__view" aria-hidden="true">View</span>
      </div>
      <div className="pcard__info">
        <span className="pcard__name">{product.name}</span>
        <span className="pcard__price">{eur(product.price)}</span>
      </div>
      {product.category && <div className="pcard__meta">{product.category}</div>}
    </Link>
  );
};

export default ProductCard;
