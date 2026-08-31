import React from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useProducts } from '../context/ProductsContext';
import { useLanguage } from '../context/LanguageContext';
import GenderCategories from '../components/GenderCategories';
import './Home.css';

const heroImage = "https://www.bukur.co/_next/image?url=%2Fimages%2Fcollections%2Ffemale.webp&w=1920&q=75";

const Home = () => {
  const { products } = useProducts();
  const { t } = useLanguage();
  const featuredProducts = products.slice(0, 8);

  return (
    <div className="home">
      <section className="hero-section">
        <div className="hero-bg-container">
          <img src={heroImage} alt="BUKUR Campaign" className="hero-bg-image" />
        </div>

        <div className="hero-content-bottom">
          <h2 className="hero-category">{t('EXPLORE BUKUR')}</h2>
          <Link to="/products" className="hero-explore-btn">
            {t('SHOP NOW')}
          </Link>
        </div>
      </section>

      <section className="featured-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">{t('New Arrivals')}</h2>
            <Link to="/products" className="view-all-link">
              {t('View All →')}
            </Link>
          </div>
          <div className="products-grid">
            {featuredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <GenderCategories />

      <section className="about-section">
        <div className="container">
          <div className="about-content">
            <h2 className="section-title">{t('About BUKUR')}</h2>
            <p className="about-text">
              {t('BUKUR represents a leading luxury fashion brand from Kosovo.')}
            </p>
            <p className="about-text">
              {t('We create refined collections that celebrate contemporary style, quality, and confident self-expression.')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
