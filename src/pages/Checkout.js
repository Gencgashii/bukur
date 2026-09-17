import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrdersContext';
import usePageMeta from '../hooks/usePageMeta';
import { track } from '../lib/analytics';
import Img from '../components/Img';
import Select from '../components/Select';
import logo from '../assets/bukur-logo.png';
import contactInfo from '../content/contact';
import {
  BANK_DETAILS,
  PAYMENT_METHODS,
  SHIPPING_COUNTRIES,
  shippingEstimateCents,
} from '../config';
import './Checkout.css';

const money = (cents) => `€${(Number(cents || 0) / 100).toFixed(2)}`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-\s0-9]{6,20}$/;

// Mirrors server/lib/validation.js POSTAL_CODE_PATTERNS — kept in sync by
// hand (two small codebases, no shared package). The server remains
// authoritative; this only gives an immediate, specific message instead of
// a round trip for something the browser can already tell is wrong.
const POSTAL_CODE_PATTERNS = {
  XK: /^\d{5}$/,
  AL: /^\d{4}$/,
  MK: /^\d{4}$/,
  AT: /^\d{4}$/,
  BE: /^\d{4}$/,
  BG: /^\d{4}$/,
  HR: /^\d{5}$/,
  FR: /^\d{5}$/,
  DE: /^\d{5}$/,
  GR: /^\d{3}\s?\d{2}$/,
  IT: /^\d{5}$/,
  SI: /^\d{4}$/,
  SE: /^\d{3}\s?\d{2}$/,
  CH: /^\d{4}$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
};

const REQUIRED_MESSAGES = {
  firstName: 'Please enter your first name.',
  lastName: 'Please enter your last name.',
  address: 'Please enter your address.',
  city: 'Please enter your city.',
  postalCode: 'Please enter your postal code.',
  email: 'Please enter your email address.',
  phone: 'Please enter your phone number.',
};

const hasBankDetails = Boolean(BANK_DETAILS.holder && BANK_DETAILS.iban);
const COUNTRY_OPTIONS = SHIPPING_COUNTRIES.map((c) => ({ value: c.code, label: c.label }));
const studio = contactInfo.channels.find((c) => c.label === 'Studio');

// Superset of every field validateField() knows about — always validated
// (so a format error on an optional field, e.g. a stray postal code, is
// still caught), independent of which subset is currently REQUIRED.
const ALL_CHECKOUT_FIELDS = ['firstName', 'lastName', 'address', 'city', 'postalCode', 'email', 'phone'];

// Only payment methods that can actually be completed today. Online card
// (card_teb) is intentionally omitted — see server/payments/providers/teb.js.
const PAYMENT_OPTIONS = [
  {
    value: PAYMENT_METHODS.BANK_TRANSFER,
    label: 'Bank transfer',
    hint: 'Account details and a payment reference are shown after you place the order.',
  },
  {
    value: PAYMENT_METHODS.CASH_ON_DELIVERY,
    label: 'Cash on delivery',
    hint: 'Pay the courier when your order arrives.',
  },
];

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
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const idempotencyKeyRef = useRef(null);

  // Server is authoritative for the final total. Tax is 0 and shipping is a flat
  // per-country rate the client also knows, so the figure below matches the
  // server's — it is shown as the Total, not an "estimate".
  const shippingCents = shippingEstimateCents(formData.country);
  const subtotal = getCartTotal();
  const grandTotal = subtotal + shippingCents / 100;
  const countryLabel =
    SHIPPING_COUNTRIES.find((c) => c.code === formData.country)?.label || formData.country;

  useEffect(() => {
    if (cartItems.length) {
      track('begin_checkout', {
        items: cartItems.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price, size: i.size })),
        value: subtotal,
      });
    }
    // once, on entering checkout with a non-empty bag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Address/city/postal code are only meaningful for home delivery — collect
  // in studio needs just enough to identify and contact the customer.
  const requiredFields = useMemo(() => {
    const always = ['firstName', 'lastName', 'email', 'phone'];
    return deliveryMethod === 'home' ? [...always, 'address', 'city', 'postalCode'] : always;
  }, [deliveryMethod]);

  // Stale errors/messages from a field that's no longer shown (or no longer
  // required) must not silently block submission, and must not reappear with
  // outdated text if the field is shown again later.
  useEffect(() => {
    setFieldErrors((fe) => ({ ...fe, address: '', city: '', postalCode: '' }));
  }, [deliveryMethod]);

  const validateField = (name, value) => {
    const v = (value ?? '').trim();
    if (requiredFields.includes(name) && !v) {
      return REQUIRED_MESSAGES[name] || `${labelFor(name)} is required.`;
    }
    if (name === 'email' && v && !EMAIL_RE.test(v)) return 'Enter a valid email address.';
    if (name === 'phone' && v && !PHONE_RE.test(v)) return 'Enter a valid phone number.';
    // Only checked for home delivery — the field is hidden for pickup, so it
    // must never be able to block that submission even if it holds leftover
    // text from before the customer switched delivery methods.
    if (name === 'postalCode' && v && deliveryMethod === 'home') {
      const pattern = POSTAL_CODE_PATTERNS[formData.country];
      if (pattern && !pattern.test(v)) {
        return `Enter a valid postal code for ${countryLabel}.`;
      }
    }
    return '';
  };

  const validateAll = () => {
    const next = {};
    ALL_CHECKOUT_FIELDS.forEach((f) => {
      const msg = validateField(f, formData[f]);
      if (msg) next[f] = msg;
    });
    return next;
  };

  if (cartItems.length === 0 && !orderResult) {
    return (
      <div className="co">
        <div className="co__topbar container">
          <button className="co__back" onClick={() => navigate('/cart')}>‹ Bag</button>
          <span className="co__mark"><img src={logo} alt="BUKUR" width="189" height="189" /></span>
          <span className="co__topbar-end" />
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
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
    if (touched[name]) {
      setFieldErrors((fe) => ({ ...fe, [name]: validateField(name, value) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
    setFieldErrors((fe) => ({ ...fe, [name]: validateField(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // guard double-submit / double-click

    const errs = validateAll();
    setFieldErrors(errs);
    setTouched(Object.fromEntries(ALL_CHECKOUT_FIELDS.map((f) => [f, true])));
    if (Object.keys(errs).length) {
      setError('Please check the highlighted fields.');
      const first = document.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }

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
        total: grandTotal, // informational only; server recalculates
      };

      const created = await addOrder(payload, { idempotencyKey: idempotencyKeyRef.current });

      track('purchase', {
        transaction_id: created.orderNumber || created.orderId,
        value: (created.totals?.totalCents ?? Math.round(grandTotal * 100)) / 100,
        shipping: (created.totals?.shippingCents ?? shippingCents) / 100,
        payment_method: created.paymentMethod,
      });

      try {
        localStorage.setItem('bukur-ship-country', formData.country);
      } catch { /* ignore */ }

      clearCart();
      setOrderResult({ order: created });
    } catch (submitErr) {
      // No fake success. Cart is preserved. Customer sees the real reason.
      setError(
        submitErr.message ||
          'Your order could not be placed and no payment was taken. Please review your details and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderResult) {
    const { order } = orderResult;
    const totals = order.totals || {};
    const isBankTransfer = order.paymentMethod === PAYMENT_METHODS.BANK_TRANSFER;
    return (
      <div className="co">
        <div className="co__topbar container">
          <button className="co__back" onClick={() => navigate('/')}>‹ Store</button>
          <span className="co__mark"><img src={logo} alt="BUKUR" width="189" height="189" /></span>
          <span className="co__topbar-end" />
        </div>
        <div className="co__done container container--narrow">
          <p className="u-eyebrow">Thank you</p>
          <h1 className="u-display u-display--light">Order placed</h1>
          <p className="co__ref">
            Reference <strong>{order.orderNumber || order.id}</strong> · Payment status:{' '}
            <strong>{order.paymentStatus}</strong>
          </p>
          <p className="co__ref">A confirmation has been sent to your email.</p>

          <div className="co__done-totals">
            <div><span>Subtotal</span><span>{money(totals.subtotalCents)}</span></div>
            <div><span>Shipping</span><span>{money(totals.shippingCents)}</span></div>
            {totals.discountCents ? <div><span>Discount</span><span>−{money(totals.discountCents)}</span></div> : null}
            {totals.taxCents ? <div><span>Tax</span><span>{money(totals.taxCents)}</span></div> : null}
            <div className="co__done-total"><span>Total</span><span>{money(totals.totalCents)}</span></div>
          </div>

          {isBankTransfer && (
            <div className="co__bank">
              <p className="u-fine">Bank transfer instructions</p>
              {hasBankDetails ? (
                <>
                  <p>Account holder: {BANK_DETAILS.holder}</p>
                  <p>IBAN: {BANK_DETAILS.iban}</p>
                  <p>Bank: {BANK_DETAILS.bank}{BANK_DETAILS.swift ? ` · SWIFT ${BANK_DETAILS.swift}` : ''}</p>
                  <p>Amount: {money(totals.totalCents)}</p>
                  <p>Payment reference: <strong>{order.orderNumber || order.id}</strong></p>
                  <p className="u-muted">Your order ships once we confirm the transfer.</p>
                </>
              ) : (
                <p className="u-muted">
                  We will email you the bank account details and a payment reference. Your order
                  ships once we confirm the transfer.
                </p>
              )}
            </div>
          )}

          <button className="btn btn--ghost" style={{ marginTop: '2rem' }} onClick={() => navigate('/')}>
            Continue shopping
          </button>
        </div>
      </div>
    );
  }

  const fieldProps = (name, extra = {}) => ({
    name,
    value: formData[name],
    onChange: handleChange,
    onBlur: handleBlur,
    'aria-invalid': fieldErrors[name] ? 'true' : undefined,
    'aria-describedby': fieldErrors[name] ? `${name}-err` : undefined,
    ...extra,
  });

  // Always rendered (even with empty text) so its reserved height in
  // .co__field never appears/disappears — otherwise every field below the
  // one that just failed validation visibly jumps up or down as errors
  // toggle. role="alert" still announces the text change when it fills in.
  const FieldError = ({ name }) => (
    <span className="co__field-err" id={`${name}-err`} role="alert">{fieldErrors[name] || ''}</span>
  );

  return (
    <div className="co">
      <div className="co__topbar container">
        <button className="co__back" onClick={() => navigate('/cart')}>‹ Bag</button>
        <Link to="/" className="co__mark"><img src={logo} alt="BUKUR" width="189" height="189" /></Link>
        <span className="co__phone">Secure checkout</span>
      </div>

      <div className="co__grid container">
        <div className="co__main">
          <form className="co__form" onSubmit={handleSubmit} noValidate>
            <section className="co__step">
              <h2 className="co__step-title"><span className="co__step-num">01</span> Shipping</h2>

              <div className="co__radios" role="radiogroup" aria-label="Delivery method">
                <label className="co__radio">
                  <input type="radio" name="deliveryMethod" value="home" checked={deliveryMethod === 'home'} onChange={() => setDeliveryMethod('home')} />
                  <span>Home delivery<small>1–3 business days</small></span>
                </label>
                <label className="co__radio">
                  <input type="radio" name="deliveryMethod" value="store" checked={deliveryMethod === 'store'} onChange={() => setDeliveryMethod('store')} />
                  <span>Collect in studio<small>Prishtina</small></span>
                </label>
              </div>

              <div className="co__fields">
                <div className="co__row">
                  <label className="co__field">First name*
                    <input type="text" autoComplete="given-name" {...fieldProps('firstName')} required />
                    <FieldError name="firstName" />
                  </label>
                  <label className="co__field">Last name*
                    <input type="text" autoComplete="family-name" {...fieldProps('lastName')} required />
                    <FieldError name="lastName" />
                  </label>
                </div>
                {deliveryMethod === 'home' && (
                  <label className="co__field">Address*
                    <input type="text" autoComplete="street-address" placeholder="Street and number" {...fieldProps('address')} required />
                    <FieldError name="address" />
                  </label>
                )}
                <div className="co__field">Country*
                  <Select
                    autoComplete="country"
                    options={COUNTRY_OPTIONS}
                    ariaLabel="Country"
                    required
                    {...fieldProps('country')}
                  />
                </div>
                {deliveryMethod === 'home' && (
                  <div className="co__row co__row--3">
                    <label className="co__field">City*
                      <input type="text" autoComplete="address-level2" {...fieldProps('city')} required />
                      <FieldError name="city" />
                    </label>
                    <label className="co__field">State / region
                      <input type="text" autoComplete="address-level1" {...fieldProps('state')} />
                    </label>
                    <label className="co__field">Postal code*
                      <input type="text" inputMode="text" autoComplete="postal-code" {...fieldProps('postalCode')} required />
                      <FieldError name="postalCode" />
                    </label>
                  </div>
                )}
                {deliveryMethod === 'store' && studio && (
                  <div className="co__pickup">
                    <p className="u-fine">Collect at BUKUR Studio</p>
                    <p>{studio.value}</p>
                    {studio.note && <p className="u-muted">{studio.note}</p>}
                    <p className="u-muted">We will confirm collection details by email after you place your order.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="co__step">
              <h2 className="co__step-title"><span className="co__step-num">02</span> Payment &amp; contact</h2>
              <div className="co__fields">
                <div className="co__row">
                  <label className="co__field">Email*
                    <input type="email" inputMode="email" autoComplete="email" {...fieldProps('email')} required />
                    <FieldError name="email" />
                  </label>
                  <label className="co__field">Phone*
                    <input type="tel" inputMode="tel" autoComplete="tel" {...fieldProps('phone')} required />
                    <FieldError name="phone" />
                  </label>
                </div>

                <p className="co__label">Payment method</p>
                <div className="co__radios co__radios--stack" role="radiogroup" aria-label="Payment method">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <label className="co__radio" key={opt.value}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={opt.value}
                        checked={formData.paymentMethod === opt.value}
                        onChange={handleChange}
                      />
                      <span>{opt.label}<small>{opt.hint}</small></span>
                    </label>
                  ))}
                </div>
                <p className="co__paynote">
                  BUKUR never takes card details on this site. Secure online card payment is coming soon.
                </p>
              </div>
            </section>

            {error && <div className="co__error" role="alert">{error}</div>}

            <button type="submit" className="btn btn--block" disabled={isSubmitting}>
              {isSubmitting ? 'Placing your order…' : `Place order · ${money(Math.round(grandTotal * 100))}`}
            </button>
          </form>
        </div>

        <aside className="co__summary" aria-label="Order summary">
          <div className="co__sum-head">
            <h2 className="co__sum-title">Order summary</h2>
            <span className="co__sum-count">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</span>
          </div>
          <ul className="co__sum-items">
            {cartItems.map((item, index) => (
              <li key={`${item.id}-${item.size}-${index}`}>
                <div className="co__sum-thumb">
                  {item.images?.[0] ? <Img src={item.images[0]} alt={item.name} sizes="60px" fill /> : <span />}
                </div>
                <div className="co__sum-info">
                  <span className="co__sum-name">{item.name}</span>
                  <span className="co__sum-meta">Qty {item.quantity}{item.size ? ` · EU ${item.size}` : ''}</span>
                </div>
                <span className="co__sum-price">€{(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="co__sum-totals">
            <div><span>Subtotal</span><span>€{subtotal.toFixed(2)}</span></div>
            <div><span>Shipping ({countryLabel})</span><span>{shippingCents > 0 ? money(shippingCents) : 'Free'}</span></div>
            <div className="co__sum-grand"><span>Total</span><span>€{grandTotal.toFixed(2)}</span></div>
          </div>
          <ul className="co__assure">
            <li>Prices in EUR. Shipping is the flat rate for your country.</li>
            <li>Complimentary delivery across Kosovo &amp; the region</li>
            <li>14-day returns</li>
          </ul>
        </aside>
      </div>
    </div>
  );
};

function labelFor(name) {
  return {
    firstName: 'First name',
    lastName: 'Last name',
    address: 'Address',
    city: 'City',
    postalCode: 'Postal code',
    email: 'Email',
    phone: 'Phone',
  }[name] || name;
}

export default Checkout;
