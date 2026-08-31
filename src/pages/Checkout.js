import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrdersContext';
import './Checkout.css';

const Checkout = () => {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { addOrder } = useOrders();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    email: '',
    phone: '',
    paymentMethod: 'card'
  });
  const [deliveryMethod, setDeliveryMethod] = useState('home');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);

  // Auto-detect shipping cost based on entered Country/State string
  // If user types 'kosovo' or 'albania' (case-insensitive)
  const isKosovo = formData.state.toLowerCase().includes('kosovo');
  const isAlbania = formData.state.toLowerCase().includes('albania');
  const shippingCost = isKosovo ? 1.80 : isAlbania ? 4.80 : 0;
  const grandTotal = getCartTotal() + shippingCost;

  if (cartItems.length === 0 && !orderPlaced) {
    return (
      <div className="checkout-page-gucci empty">
        <header className="checkout-header-gucci">
          <button className="back-link" onClick={() => navigate('/cart')}>
            ‹ Back to Shopping Bag
          </button>
          <div className="logo" style={{ letterSpacing: '0.2em', fontWeight: '700' }}>BUKUR</div>
        </header>
        <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>
          <p>Your cart is empty. Please add items to your cart first.</p>
          <button className="continue-button-gucci" onClick={() => navigate('/')}>Continue Shopping</button>
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    await new Promise(resolve => setTimeout(resolve, 1500));
    const total = grandTotal;

    try {
      const createdOrder = await addOrder({
        customerName: `${formData.firstName} ${formData.lastName}`.trim(),
        customerEmail: formData.email,
        phone: formData.phone,
        paymentMethod: formData.paymentMethod,
        paymentStatus: formData.paymentMethod === 'card' ? 'Captured' : 'Authorized',
        fulfillmentStatus: 'Not fulfilled',
        shippingAddress: {
          address: formData.address,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
        },
        items: cartItems,
        total,
      });

      clearCart();
      setConfirmationEmailSent(Boolean(createdOrder?.emailSent));
      setOrderPlaced(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="checkout-page-gucci empty">
        <header className="checkout-header-gucci">
          <button className="back-link" onClick={() => navigate('/')}>
            ‹ Back to Store
          </button>
          <div className="logo" style={{ letterSpacing: '0.2em', fontWeight: '700' }}>BUKUR</div>
        </header>
        <div className="order-success-gucci">
          <div className="success-icon">✓</div>
          <h1>Order Placed Successfully!</h1>
          <p>
            {confirmationEmailSent
              ? `Your confirmation has been sent to ${formData.email}.`
              : 'Your order has been saved. Confirmation email delivery is not available yet.'}
          </p>
          <button className="continue-button-gucci" onClick={() => navigate('/')}>
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page-gucci">
      <header className="checkout-header-gucci">
        <button className="back-link" onClick={() => navigate('/cart')}>
          ‹ Back to Shopping Bag
        </button>
        <div className="logo" style={{ letterSpacing: '0.2em', fontWeight: '700' }}>BUKUR</div>
        <div className="contact-phone">📞 +383 49 123 456</div>
      </header>

      <div className="checkout-container-gucci">
        <div className="checkout-left">
          <div className="checkout-user-info">
            <span className="user-label">YOU ARE CHECKING OUT AS:</span>
            <span className="user-email">{formData.email}</span>
          </div>

          <form className="checkout-form-gucci" onSubmit={handleSubmit}>
            <div className="checkout-step">
              <div className="step-header">
                <span className="step-number">1</span>
                <h2 className="step-title">SHIPPING</h2>
              </div>

              <div className="delivery-methods">
                <label className="radio-label">
                  <input
                    type="radio"
                    value="home"
                    checked={deliveryMethod === 'home'}
                    onChange={() => setDeliveryMethod('home')}
                  />
                  <span className="radio-custom"></span>
                  <div className="radio-content">
                    <span className="radio-title">Home Delivery</span>
                    <span className="radio-desc">1-3 business days if placed by 1PM EST</span>
                  </div>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    value="store"
                    checked={deliveryMethod === 'store'}
                    onChange={() => setDeliveryMethod('store')}
                  />
                  <span className="radio-custom"></span>
                  <div className="radio-content">
                    <span className="radio-title">Collect In-Store</span>
                    <span className="radio-desc">Next business day if placed by 4 PM EST <br />(continental U.S.)</span>
                  </div>
                </label>
              </div>

              <div className="form-fields-gucci">
                <div className="form-row-gucci">
                  <div className="form-group-gucci">
                    <label htmlFor="firstName">FIRST NAME*</label>
                    <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} required />
                  </div>
                  <div className="form-group-gucci">
                    <label htmlFor="lastName">LAST NAME*</label>
                    <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} required />
                  </div>
                </div>

                <div className="form-group-gucci full-width">
                  <label htmlFor="address">ADDRESS LINE 1*</label>
                  <div className="input-with-icon">
                    <input type="text" id="address" name="address" placeholder="Start typing" value={formData.address} onChange={handleChange} required />
                    <span className="search-icon">🔍</span>
                  </div>
                </div>

                <button type="button" className="link-button">Enter address line 2</button>

                <div className="form-row-gucci three-cols">
                  <div className="form-group-gucci">
                    <label htmlFor="city">CITY*</label>
                    <input type="text" id="city" name="city" value={formData.city} onChange={handleChange} required />
                  </div>
                  <div className="form-group-gucci">
                    <label htmlFor="state">STATE*</label>
                    <input type="text" id="state" name="state" value={formData.state} onChange={handleChange} required />
                  </div>
                  <div className="form-group-gucci">
                    <label htmlFor="postalCode">ZIP CODE*</label>
                    <input type="text" id="postalCode" name="postalCode" value={formData.postalCode} onChange={handleChange} required />
                  </div>
                </div>
              </div>
            </div>

            <div className="checkout-step">
              <div className="step-header">
                <span className="step-number">2</span>
                <h2 className="step-title">PAYMENT & CONTACT</h2>
              </div>
              <div className="form-fields-gucci">
                <div className="form-row-gucci">
                  <div className="form-group-gucci">
                    <label htmlFor="email">EMAIL*</label>
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
                  </div>
                  <div className="form-group-gucci">
                    <label htmlFor="phone">PHONE*</label>
                    <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} required />
                  </div>
                </div>

                <h3 style={{ fontSize: '0.8rem', marginTop: '1rem', letterSpacing: '1px' }}>PAYMENT METHOD</h3>
                <div className="delivery-methods" style={{ marginTop: '0.5rem' }}>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={formData.paymentMethod === 'card'}
                      onChange={handleChange}
                    />
                    <span className="radio-custom"></span>
                    <div className="radio-content">
                      <span className="radio-title">Credit/Debit Card</span>
                    </div>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={formData.paymentMethod === 'cash'}
                      onChange={handleChange}
                    />
                    <span className="radio-custom"></span>
                    <div className="radio-content">
                      <span className="radio-title">Cash on Delivery</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <button type="submit" className="submit-button-gucci" disabled={isSubmitting}>
              {isSubmitting ? 'PROCESSING...' : `PLACE ORDER - €${grandTotal.toFixed(2)}`}
            </button>
          </form>
        </div>

        <div className="checkout-right">
          <div className="order-summary-gucci">
            <h2 className="summary-title-gucci">ORDER SUMMARY</h2>
            <p className="summary-subtitle-gucci">👜 {cartItems.length} ITEM{cartItems.length !== 1 && 'S'}</p>

            <div className="summary-items-gucci">
              {cartItems.map((item, index) => (
                <div key={`${item.id}-${item.size}-${index}`} className="summary-item-gucci">
                  <div className="item-image-gucci">
                    {item.images && item.images[0] ? (
                      <img src={item.images[0]} alt={item.name} />
                    ) : (
                      <div className="placeholder-img" />
                    )}
                  </div>
                  <div className="item-details-gucci">
                    <div className="item-header-gucci">
                      <span className="item-name-gucci">{item.name}</span>
                      <span className="item-qty-gucci">QTY: {item.quantity}</span>
                    </div>
                    <span className="item-style-gucci">Style #{item.id}9653</span>
                    <span className="item-variation-gucci">Variation: Size {item.size}</span>
                    <div className="item-price-gucci">
                      <span className="delivery-note">Enjoy complimentary<br />delivery or Collect In Store.</span>
                      <span className="price-val">€{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="summary-totals-gucci">
              <div className="total-row-gucci">
                <span>Subtotal</span>
                <span>€{getCartTotal().toFixed(2)}</span>
              </div>
              <div className="total-row-gucci">
                <span>Shipping {isKosovo ? '(Kosovo Post)' : isAlbania ? '(Albania Post)' : ''}</span>
                <span>{shippingCost > 0 ? `€${shippingCost.toFixed(2)}` : 'Free'}</span>
              </div>
              <div className="total-row-gucci grand-total">
                <span>ESTIMATED TOTAL</span>
                <span>€{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              className="view-details-gucci"
              onClick={(e) => { e.preventDefault(); setIsViewDetailsOpen(!isViewDetailsOpen); }}
            >
              <span>VIEW DETAILS</span>
              <span>{isViewDetailsOpen ? '—' : '+'}</span>
            </button>

            {isViewDetailsOpen && (
              <>
                <p className="summary-disclaimer">
                  You will be charged at the time of shipment. If this is a personalized or made-to-order purchase, you will be charged at the time of purchase.
                </p>
                <div className="in-stock-note" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>In Stock</span>
                  <span>€{getCartTotal().toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
