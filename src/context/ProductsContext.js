import React, { createContext, useContext, useEffect, useState } from 'react';
import { products as initialProducts } from '../data/products';
import { API_URL } from '../config';

const ProductsContext = createContext();

export const useProducts = () => {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error('useProducts must be used within a ProductsProvider');
  }
  return context;
};

export const ProductsProvider = ({ children }) => {
  const [products, setProducts] = useState(initialProducts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const url = `${API_URL.replace(/\/$/, '')}/store/products?limit=100`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Could not load products from the backend');
        const data = await response.json();
        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products.map(normalizeApiProduct));
        }
      } catch (requestError) {
        setError(requestError);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const addProduct = (newProduct) => {
    const created = { ...newProduct, id: Date.now() };
    setProducts((prev) => [created, ...prev]);
    return Promise.resolve(created);
  };

  const updateProduct = (id, updates) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    return Promise.resolve({ id, ...updates });
  };

  const deleteProduct = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    return Promise.resolve();
  };

  const value = {
    products,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
  };

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
};

// Normalises a product from the BUKUR Express API (server/lib/serializers.js).
// The extra `?.` fallbacks tolerate older/other backend shapes; the live API
// provides `priceCents`, `sizes`, `images`, `thumbnail`, `stock`, `status`.
const normalizeApiProduct = (product) => {
  const variant = product.variants?.[0];
  const priceCents =
    product.priceCents ??
    variant?.calculated_price?.calculated_amount ??
    variant?.prices?.[0]?.amount ??
    0;
  const option = product.options?.find((item) => item.title?.toLowerCase() === 'size');
  // Sizes come from the authoritative backend (`product.sizes`). They are NOT
  // fabricated. An empty list means the product has no configured sizes yet.
  const sizes =
    Array.isArray(product.sizes) && product.sizes.length
      ? product.sizes.map(String)
      : option?.values?.map((item) => item.value) || [];
  const images = (product.images?.map((image) => image.url) || []).filter(Boolean);
  const primary = product.thumbnail || images[0] || '';

  const tracks = Boolean(product.trackInventory);
  const stock = Number(product.stock ?? 0);
  const published = product.status ? product.status === 'published' : true;
  const inStock = published && (!tracks || stock > 0);

  return {
    id: product.id,
    name: product.title || product.name || 'Untitled',
    sku: product.sku || '',
    price: priceCents / 100,
    priceCents,
    image: primary,
    images: images.length ? images : [primary].filter(Boolean),
    description: product.description || '',
    category: product.category?.name || product.categories?.[0]?.name || 'Heels',
    categoryId: product.categoryId ?? product.category?.id ?? null,
    gender: 'Women',
    sizes,
    featured: Boolean(product.featured),
    newArrival: Boolean(product.newArrival),
    stock,
    trackInventory: tracks,
    inStock,
  };
};
