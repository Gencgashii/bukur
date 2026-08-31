import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handlePrev = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.images && product.images.length > 0) {
      setCurrentImageIndex((prev) => (prev === 0 ? product.images.length - 1 : prev - 1));
    }
  };

  const handleNext = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.images && product.images.length > 0) {
      setCurrentImageIndex((prev) => (prev === product.images.length - 1 ? 0 : prev + 1));
    }
  };

  const images = product.images && product.images.length > 0 ? product.images : [product.image];
  const currentImage = images[currentImageIndex];
  const hasMultipleImages = images.length > 1;

  return (
    <Link to={`/product/${product.id}`} className="product-card">
      <div className="product-image-wrapper">
        <img
          src={currentImage}
          alt={product.name}
          className={`product-image ${currentImageIndex === 0 && hasMultipleImages ? 'primary-image' : ''}`}
        />
        {currentImageIndex === 0 && hasMultipleImages && (
          <img
            src={product.images[1]}
            alt={`${product.name} alternate`}
            className="product-image secondary-image"
          />
        )}

        {hasMultipleImages && (
          <>
            <button className="carousel-btn prev-btn" onClick={handlePrev} aria-label="Previous image">
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 1L1 7L7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="carousel-btn next-btn" onClick={handleNext} aria-label="Next image">
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L7 7L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="carousel-indicators">
              {images.map((_, index) => (
                <div
                  key={index}
                  className={`indicator ${index === currentImageIndex ? 'active' : ''}`}
                />
              ))}
            </div>
          </>
        )}

        {!product.inStock && (
          <div className="out-of-stock-badge">Out of Stock</div>
        )}
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-price">€{product.price.toFixed(2)}</p>
      </div>
    </Link>
  );
};

export default ProductCard;
