import React, { createContext, useContext, useEffect, useState } from 'react';
import { products as initialProducts } from '../data/products';
import { API_URL } from '../config';
import { normalizeApiProduct } from '../lib/normalizeProduct';

// This context exists ONLY to feed the small "4 products" widgets (Home's new
// arrivals, Cart's upsell row) — NOT the /products catalog, which fetches its
// own paginated results directly (see src/pages/Products.js). Kept small on
// purpose: those widgets only ever slice 4 items, so there's no reason to
// pull anywhere near a full catalog page for them.
const WIDGET_PRODUCTS_LIMIT = 16;

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
        const url = `${API_URL.replace(/\/$/, '')}/store/products?limit=${WIDGET_PRODUCTS_LIMIT}&sort=new`;
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
