import React from 'react';
import ProductCard from './ProductCard';

/** Reusable product grid. `cols` = 2 | 3 | 4 (desktop). */
const ProductGrid = ({ products = [], cols = 3, priorityCount = 0 }) => (
  <div className={`pgrid ${cols === 4 ? 'pgrid--4' : cols === 2 ? 'pgrid--2' : ''}`}>
    {products.map((p, i) => (
      <ProductCard key={p.id} product={p} index={i} priority={i < priorityCount} />
    ))}
  </div>
);

export default ProductGrid;
