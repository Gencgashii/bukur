import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrdersContext';
import usePageMeta from '../hooks/usePageMeta';
import Img from '../components/Img';
import {
  API_URL,
  BANK_DETAILS,
  PAYMENT_METHODS,
  SHIPPING_COUNTRIES,
  shippingEstimateCents,
} from '../config';
import './Checkout.css';

const money = (cents) => `€${(Number(cents || 0) / 100).toFixed(2)}`;

const Checkout = () => {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { addOrder } = useOrders();
  usePageMeta('Checkout');

  const initialCountry =
    (typeof localStorage !== 'undefined' && localStorage.getItem('bukur-ship-country')) || 'XK';

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    email: '',
    phone: '',
    country: SHIPPING_COUNTRIES.some((c) => c.code === initialCountry) ? initialCountry : 'XK',
    paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
  });
  const [deliveryMethod, setDeliveryMethod] = useState('home');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [error, setError] = useState('');
  const idempotencyKeyRef = useRef(null);

  // Pre-submit ESTIMATE only. The backend returns the authoritative total.
  const shippingEstCents = shippingEstimateCents(formData.country);
  const subtotalEst = getCartTotal();
  const grandTotalEst = subtotalEst + shippingEstCents / 100;
  const countryLabel =
    SHIPPING_COUNTRIES.find((c) => c.code === formData.country)?.label || formData.country;

  if (cartItems.length === 0 && !orderResult) {
    return (
      <div className="co">
        <div className="co__topbar container">
          <button className="co__back" onClick={() => navigate('/cart')}>‹ Bag</button>
          <span className="co__mark">BUKUR</span>
          <span />
        </div>
        <div className="state">
          <p className="u-eyebrow">Checkout</p>
          <h1 className="u-title">Your bag is empty</h1>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/products')} style={{ justifySelf: 'center' }}>
            Continue shopping
          </button>
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const initiatePayment = async (orderId) => {
    const res = await fetch(`${API_URL.replace(/\/$/, '')}/store/custom/payments/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `${idempotencyKeyRef.current}:pay`,
      },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(data?.error?.message || 'Online payment could not be started.');
      err.code = data?.error?.code;
      err.status = res.status;
      throw err;
    }
    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // guard double-submit / double-click
    setError('');
    setIsSubmitting(true);

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
        `bk-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    try {
      const payload = {
        customerName: `${formData.firstName} ${formData.lastName}`.trim(),
        customerEmail: formData.email,
        phone: formData.phone,
        country: formData.country,
        paymentMethod: formData.paymentMethod,
        shippingMethod: deliveryMethod === 'store' ? 'pickup' : 'standard',
        shippingAddress: {
          address: formData.address,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
        },
        items: cartItems.map((i) => ({ id: i.id, size: i.size, quantity: i.quantity })),
        total: grandTotalEst, // informational only; server recalculates
      };

      const created = await addOrder(payload, { idempotencyKey: idempotencyKeyRef.current });

      let payment = null;
      let paymentNotice = '';
      if (created.requiresPayment) {
        try {
          payment = await initiatePayment(created.orderId);
          if (payment?.redirectUrl) {
            paymentNotice = 'Your order is placed. Continue to the secure payment page to complete payment.';
          }
        } catch (payErr) {
          paymentNotice =
            payErr.status === 501
              ? 'Your order is placed. Online card payment is not available yet — we will email you secure payment instructions.'
              : `Your order is placed, but online payment could not start: ${payErr.message}`;
        }
      }

      clearCart();
      setOrderResult({ order: created, payment, paymentNotice });
    } catch (submitErr) {
      // No fake success. Cart is preserved. Customer sees the real reason.
      setError(submitErr.message || 'Your order could not be placed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderResult) {
    const { order, paymentNotice } = orderResult;
    const totals = order.totals || {};
    const isBankTransfer = order.paymentMethod === PAYMENT_METHODS.BANK_TRANSFER;
    return (
      <div className="co">
        <div className="co__topbar container">
          <button className="co__back" onClick={() => navigate('/')}>‹ Store</button>
          <span className="co__mark">BUKUR</span>
          <span />
        </div>
        <div className="co__done container container--narrow">
          <p className="u-eyebrow">Thank you</p>
          <h1 className="u-title">Order placed</h1>
          <p className="co__ref">Reference <strong>{order.orderNumber || order.id}</strong> · Payment status: <strong>{order.paymentStatus}</strong></p>

          <div className="co__done-totals">
            <div><span>Subtotal</span><span>{money(totals.subtotalCents)}</span></div>
            <div><span>Shipping</span><span>{money(totals.shippingCents)}</span></div>
            {totals.taxCents ? <div><span>Tax</span><span>{money(totals.taxCents)}</span></div> : null}
            <div className="co__done-total"><span>Total</span><span>{money(totals.totalCents)}</span></div>
          </div>

          {isBankTransfer && (
            <div className="co__bank">
              <p className="u-fine">Bank transfer instructions</p>
              <p>Account holder: {BANK_DETAILS.holder}</p>
              <p>IBAN: {BANK_DETAILS.iban}</p>
              <p>Bank: {BANK_DETAILS.bank}{BANK_DETAILS.swift ? ` · SWIFT ${BANK_DETAILS.swift}` : ''}</p>
              <p>Amount: {money(totals.totalCents)}</p>
              <p>Payment reference: <strong>{order.orderNumber || order.id}</strong></p>
              <p className="u-muted">Your order ships once we confirm the transfer.</p>
            </div>
          )}

          {paymentNotice && <p className="co__notice">{paymentNotice}</p>}

          <button className="btn btn--ghost" style={{ marginTop: '2rem' }} onClick={() => navigate('/')}>
            Continue shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="co">
      <div className="co__topbar container">
        <button className="co__back" onClick={() => navigate('/cart')}>‹ Bag</button>
        <Link to="/" className="co__mark">BUKUR</Link>
        <span className="co__phone">+383 49 123 456</span>
      </div>

      <div className="co__grid container">
        <div className="co__main">
          <form className="co__form" onSubmit={handleSubmit}>
            <section className="co__step">
              <h2 className="co__step-title"><span>01</span> Shipping</h2>

              <div className="co__radios">
                <label className="co__radio">
                  <input type="radio" value="home" checked={deliveryMethod === 'home'} onChange={() => setDeliveryMethod('home')} />
                  <span>Home delivery<small>1–3 business days</small></span>
                </label>
                <label className="co__radio">
                  <input type="radio" value="store" checked={deliveryMethod === 'store'} onChange={() => setDeliveryMethod('store')} />
                  <span>Collect in studio<small>Prishtina</small></span>
                </label>
              </div>

              <div className="co__fields">
                <div className="co__row">
                  <label className="co__field">First name*
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required />
                  </label>
                  <label className="co__field">Last name*
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required />
                  </label>
                </div>
                <label className="co__field">Address*
                  <input type="text" name="address" placeholder="Street and number" value={formData.address} onChange={handleChange} required />
                </label>
                <label className="co__field">Country*
                  <select name="country" value={formData.country} onChange={handleChange} required>
                    {SHIPPING_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </label>
                <div className="co__row co__row--3">
                  <label className="co__field">City*
                    <input type="text" name="city" value={formData.city} onChange={handleChange} required />
                  </label>
                  <label className="co__field">State / region
                    <input type="text" name="state" value={formData.state} onChange={handleChange} />
                  </label>
                  <label className="co__field">Postal code*
                    <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} required />
                  </label>
                </div>
              </div>
            </section>

            <section className="co__step">
              <h2 className="co__step-title"><span>02</span> Payment &amp; contact</h2>
              <div className="co__fields">
                <div className="co__row">
                  <label className="co__field">Email*
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                  </label>
                  <label className="co__field">Phone*
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required />
                  </label>
                </div>

                <p className="u-fine" style={{ marginTop: '0.5rem' }}>Payment method</p>
                <div className="co__radios co__radios--stack">
                  <label className="co__radio">
                    <input type="radio" name="paymentMethod" value={PAYMENT_METHODS.BANK_TRANSFER} checked={formData.paymentMethod === PAYMENT_METHODS.BANK_TRANSFER} onChange={handleChange} />
                    <span>Bank transfer<small>IBAN details shown after you place the order</small></span>
                  </label>
                  <label className="co__radio">
                    <input type="radio" name="paymentMethod" value={PAYMENT_METHODS.CASH_ON_DELIVERY} checked={formData.paymentMethod === PAYMENT_METHODS.CASH_ON_DELIVERY} onChange={handleChange} />
                    <span>Cash on delivery<small>Pay the courier on arrival</small></span>
                  </label>
                  <label className="co__radio">
                    <input type="radio" name="paymentMethod" value={PAYMENT_METHODS.CARD_TEB} checked={formData.paymentMethod === PAYMENT_METHODS.CARD_TEB} onChange={handleChange} />
                    <span>Card (online)<small>Secure card payment — coming soon</small></span>
                  </label>
                </div>
              </div>
            </section>

            {error && <div className="co__error" role="alert">{error}</div>}

            <button type="submit" className="btn btn--block" disabled={isSubmitting}>
              {isSubmitting ? 'Processing…' : `Place order — ${money(Math.round(grandTotalEst * 100))} (est.)`}
            </button>
          </form>
        </div>

        <aside className="co__summary">
          <h2 className="u-fine">Order summary · {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</h2>
          <ul className="co__sum-items">
            {cartItems.map((item, index) => (
              <li key={`${item.id}-${item.size}-${index}`}>
                <div className="co__sum-thumb">
                  {item.images?.[0] ? <Img src={item.images[0]} alt={item.name} sizes="54px" fill /> : <span />}
                </div>
                <div className="co__sum-info">
                  <span className="co__sum-name">{item.name}</span>
                  <span className="u-fine u-muted">Qty {item.quantity}{item.size ? ` · EU ${item.size}` : ''}</span>
                </div>
                <span className="co__sum-price">€{(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="co__sum-totals">
            <div><span>Subtotal</span><span>€{subtotalEst.toFixed(2)}</span></div>
            <div><span>Shipping ({countryLabel})</span><span>{shippingEstCents > 0 ? money(shippingEstCents) : 'Free'}</span></div>
            <div className="co__sum-grand"><span>Estimated total</span><span>€{grandTotalEst.toFixed(2)}</span></div>
          </div>
          <p className="u-fine u-muted" style={{ marginTop: '0.75rem', lineHeight: 1.7 }}>
            This is an estimate. BUKUR calculates and confirms the final total when your order is placed.
          </p>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
