import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useProducts } from '../context/ProductsContext';
import { useLanguage } from '../context/LanguageContext';
import './Products.css';

const Products = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedGender, setSelectedGender] = useState('All');
  const { products } = useProducts();
  const { t } = useLanguage();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const genderParam = params.get('gender');
    const categoryParam = params.get('category');

    if (genderParam) {
      setSelectedGender(genderParam);
    } else {
      setSelectedGender('All');
    }

    if (categoryParam) {
      setSelectedCategory(categoryParam);
    } else {
      setSelectedCategory('All');
    }
  }, [location.search]);

  const categories = ['All', ...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => {
    const matchCategory = selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchGender = selectedGender === 'All' || p.gender === selectedGender;
    return matchCategory && matchGender;
  });

  return (
    <div className="products-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">
            {selectedGender !== 'All' ? `${selectedGender}'s Collection` : t('All Products')}
          </h1>
          <p className="page-subtitle">{t('Discover our complete collection')}</p>
        </div>

        <div className="filters" style={{ marginBottom: '15px' }}>
          {['All', 'Men', 'Women'].map(gender => (
            <button
              key={gender}
              className={`filter-button ${selectedGender === gender ? 'active' : ''}`}
              onClick={() => setSelectedGender(gender)}
              style={{ fontWeight: '600', letterSpacing: '1px' }}
            >
              {gender === 'All' ? 'ALL GENDERS' : gender.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="filters">
          {categories.map(category => (
            <button
              key={category}
              className={`filter-button ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="products-grid">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="no-products">
            <p>No products found for this selection.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
