import React, { createContext, useContext, useState } from 'react';
import { products as initialProducts } from '../data/products';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <ProductsContext.Provider
      value={{
        products,
        loading,
        error,
        addProduct,
        updateProduct,
        deleteProduct,
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
};
