import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductsContext';
import './Cart.css';

const Cart = () => {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart } = useCart();
  const { products } = useProducts();
  const navigate = useNavigate();

  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);
  const [shippingDestination, setShippingDestination] = useState('none'); // 'none', 'kosovo', 'albania'

  const shippingCost = shippingDestination === 'kosovo' ? 1.80 : shippingDestination === 'albania' ? 4.80 : 0;
  const grandTotal = getCartTotal() + shippingCost;

  if (cartItems.length === 0) {
    return (
      <div className="cart-page-gucci empty">
        <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>
          <h1 className="page-title" style={{ fontFamily: '"Bodoni Moda", serif', fontWeight: 400, marginBottom: '2rem' }}>YOUR SHOPPING BAG IS EMPTY</h1>
          <p style={{ marginBottom: '2rem', color: '#666' }}>Please add items to your cart first.</p>
          <button className="continue-button-gucci" onClick={() => navigate('/products')}>Continue Shopping</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page-gucci">
      <div className="cart-container-gucci">

        <div className="cart-left">
          <div className="cart-header-gucci">
            <h2 className="selections-title">YOUR SELECTIONS</h2>
          </div>

          <div className="cart-items-gucci">
            {cartItems.map((item, index) => (
              <div key={`${item.id}-${item.size}-${index}`} className="cart-item-gucci">
                <div className="item-image-gucci">
                  <img src={item.image || (item.images && item.images[0])} alt={item.name} />
                </div>

                <div className="item-details-gucci">
                  <div className="item-top-row">
                    <div className="item-info-main">
                      <h3 className="item-name-gucci">{item.name}</h3>
                      <p className="item-style-gucci">Style# {item.id} FAFV9 9653</p>
                      <p className="item-variation-gucci">Variation: Size {item.size}</p>
                    </div>

                    <div className="item-qty-price">
                      <div className="qty-dropdown">
                        <span className="qty-label">QTY: </span>
                        <select
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, item.size, parseInt(e.target.value))}
                          className="qty-select"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                      </div>
                      <div className="item-price-gucci">
                        € {(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="item-availability">
                    <span className="status-text">AVAILABLE</span>
                    <p className="delivery-note">Enjoy complimentary delivery or Collect In Store.</p>
                  </div>

                  <div className="item-actions-gucci">
                    <button className="action-link" onClick={() => navigate(`/product/${item.id}`)}>EDIT</button>
                    <button className="action-link" onClick={() => removeFromCart(item.id, item.size)}>REMOVE</button>
                    <button className="action-link">♡ SAVED ITEMS</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cart-right">
          <div className="order-summary-gucci">
            <h2 className="summary-title-gucci">ORDER SUMMARY</h2>
            <p className="summary-id-gucci">USCART{Math.floor(Math.random() * 1000000000)}</p>

            <div className="summary-totals-gucci">
              <div className="total-row-gucci">
                <span>Subtotal</span>
                <span>€ {getCartTotal().toFixed(2)}</span>
              </div>
              <div className="total-row-gucci">
                <span>Shipping</span>
                <div className="shipping-selector">
                  <select
                    className="shipping-dropdown"
                    value={shippingDestination}
                    onChange={(e) => setShippingDestination(e.target.value)}
                  >
                    <option value="none" disabled>Select Destination</option>
                    <option value="kosovo">Kosovo Post (€1.80)</option>
                    <option value="albania">Albania Post (€4.80)</option>
                  </select>
                </div>
              </div>
              <div className="total-row-gucci grand-total">
                <span>Estimated Total</span>
                <span>€ {grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              className="view-details-gucci"
              onClick={() => setIsViewDetailsOpen(!isViewDetailsOpen)}
            >
              <span>VIEW DETAILS</span>
              <span>{isViewDetailsOpen ? '—' : '+'}</span>
            </button>

            {isViewDetailsOpen && (
              <>
                <p className="summary-disclaimer">
                  You will be charged at the time of shipment. If this is a personalized or made-to-order purchase, you will be charged at the time of purchase.
                </p>

                <div className="in-stock-note">
                  <span>In Stock</span>
                  <span>€ {getCartTotal().toFixed(2)}</span>
                </div>
              </>
            )}

            <button className="submit-button-gucci" onClick={() => navigate('/checkout')}>
              CHECKOUT
            </button>
          </div>
        </div>
      </div>

      {/* Recommendations Carousel */}
      <div className="recommendations-container-gucci">
        <h2 className="recommendations-title-gucci">YOU MAY ALSO LIKE</h2>

        <div className="recommendations-grid-gucci">
          {products.slice(0, 4).map((product) => (
            <div key={product.id} className="recommendation-card-gucci">
              <div className="rec-image-wrapper">
                <button className="wishlist-btn-gucci">♡</button>
                <img src={product.images && product.images[0] ? product.images[0] : product.image} alt={product.name} />
              </div>
              <div className="rec-info-gucci">
                <h3 className="rec-name-gucci">{product.name}</h3>
                <p className="rec-price-gucci">€ {product.price.toFixed(2)}</p>
                <button className="shop-this-btn-gucci" onClick={() => navigate(`/product/${product.id}`)}>
                  SHOP THIS
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Cart;
