import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductsContext';
import './ProductDetail.css';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { products } = useProducts();
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showNotification, setShowNotification] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoomStyle, setZoomStyle] = useState({ transformOrigin: 'center center', transform: 'scale(1)' });

  const product = products.find(p => p.id === parseInt(id, 10));

  if (!product) {
    return (
      <div className="product-detail">
        <div className="container">
          <p>Product not found.</p>
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!selectedSize) {
      alert('Please select a size');
      return;
    }

    addToCart(product, selectedSize, quantity);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  const handlePrevImage = (e) => {
    if (e) e.stopPropagation();
    setSelectedImage((prev) => (prev === 0 ? product.images.length - 1 : prev - 1));
  };

  const handleNextImage = (e) => {
    if (e) e.stopPropagation();
    setSelectedImage((prev) => (prev === product.images.length - 1 ? 0 : prev + 1));
  };

  const handleMouseMove = (e) => {
    // Make sure we're getting the coordinates of the image itself
    const img = e.currentTarget.querySelector('img');
    if (!img) return;

    const { left, top, width, height } = img.getBoundingClientRect();
    // Calculate mouse position relative to image
    let x = ((e.clientX - left) / width) * 100;
    let y = ((e.clientY - top) / height) * 100;

    // Clamp to boundaries
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    setZoomStyle({
      transformOrigin: `${x}% ${y}%`,
      transform: 'scale(2.5)' // Zoom amount
    });
  };

  const handleMouseLeave = () => {
    setZoomStyle({
      transformOrigin: 'center center',
      transform: 'scale(1)'
    });
  };

  // Ensure we have a valid array of images
  const productImages = product.images && product.images.length > 0 ? product.images : [product.image];

  return (
    <>
      <div className="product-detail">
        <div className="container">
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>

          <div className="product-detail-content">
            <div className="product-images">
              <div
                className="main-image"
                onClick={() => setIsModalOpen(true)}
                title="Click to view full screen"
              >
                <img src={productImages[selectedImage]} alt={product.name} />
              </div>
              {productImages.length > 1 && (
                <div className="image-thumbnails">
                  {productImages.map((img, index) => (
                    <button
                      key={index}
                      className={`thumbnail ${selectedImage === index ? 'active' : ''}`}
                      onClick={() => setSelectedImage(index)}
                    >
                      <img src={img} alt={`${product.name} ${index + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="product-info-detail">
              <h1 className="product-title">{product.name}</h1>
              <p className="product-category-detail">{product.category}</p>
              <p className="product-price-detail">€{product.price.toFixed(2)}</p>

              <p className="product-description">{product.description}</p>

              <div className="product-options">
                <div className="size-selector">
                  <label className="option-label">Size</label>
                  <div className="size-buttons">
                    {product.sizes.map(size => (
                      <button
                        key={size}
                        className={`size-button ${selectedSize === size ? 'selected' : ''}`}
                        onClick={() => setSelectedSize(size)}
                        aria-pressed={selectedSize === size}
                      >
                        <span>{size}</span>
                        {selectedSize === size && <span className="selected-size-check" aria-hidden="true">✓</span>}
                      </button>
                    ))}
                  </div>
                  <p className="size-selection-status" aria-live="polite">
                    {selectedSize ? `Selected size: ${selectedSize}` : 'Select your size to continue'}
                  </p>
                </div>

                <div className="quantity-selector">
                  <label className="option-label">Quantity</label>
                  <div className="quantity-controls">
                    <button
                      className="quantity-button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      −
                    </button>
                    <span className="quantity-value">{quantity}</span>
                    <button
                      className="quantity-button"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <button
                className="add-to-cart-button"
                onClick={handleAddToCart}
                disabled={!product.inStock}
              >
                {product.inStock ? 'Add to Cart' : 'Out of Stock'}
              </button>

              {showNotification && (
                <div className="notification">
                  Added to cart!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && createPortal(
        <div className="fullscreen-modal" onClick={() => setIsModalOpen(false)}>
          <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>✕</button>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div
              className="zoom-container"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <img
                src={productImages[selectedImage]}
                alt={product.name}
                className="modal-main-image"
                style={zoomStyle}
              />
            </div>
            {productImages.length > 1 && (
              <div className="modal-controls-overlay">
                <div className="modal-thumbnails">
                  {productImages.map((img, index) => (
                    <button
                      key={index}
                      className={`modal-thumb ${selectedImage === index ? 'active' : ''}`}
                      onClick={() => setSelectedImage(index)}
                      aria-label={`View image ${index + 1}`}
                    >
                      <img src={img} alt={`Thumbnail ${index + 1}`} />
                    </button>
                  ))}
                </div>

                <button className="modal-nav-btn prev" onClick={handlePrevImage} aria-label="Previous image">
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 1L1 5L5 9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button className="modal-nav-btn next" onClick={handleNextImage} aria-label="Next image">
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L1 9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ProductDetail;
