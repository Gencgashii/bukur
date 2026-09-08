import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductsContext';
import usePageMeta from '../hooks/usePageMeta';
import ProductGrid from '../components/ProductGrid';
import Img from '../components/Img';
import './Cart.css';

const eur = (n) => `€${Number(n || 0).toLocaleString('en-IE', { maximumFractionDigits: 0 })}`;

const Cart = () => {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal } = useCart();
  const { products } = useProducts();
  const navigate = useNavigate();
  usePageMeta('Shopping Bag');

  if (cartItems.length === 0) {
    return (
      <div className="state">
        <p className="u-eyebrow">Your bag</p>
        <h1 className="u-title">Your shopping bag is empty</h1>
        <p className="u-lede" style={{ marginInline: 'auto', textAlign: 'center' }}>
          Nothing here yet. Discover the collection and find your pair.
        </p>
        <Link to="/products" className="btn btn--ghost btn--sm" style={{ justifySelf: 'center' }}>
          Continue shopping
        </Link>
      </div>
    );
  }

  const subtotal = getCartTotal();

  return (
    <div className="cart">
      <div className="container">
        <header className="cart__head">
          <div className="cart__head-title">
            <h1 className="cart__h1">Shopping bag</h1>
            <span className="cart__count">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</span>
          </div>
          <Link to="/products" className="cart__head-link link-underline link-quiet">Continue shopping</Link>
        </header>

        <div className="cart__grid">
          <ul className="cart__items">
            {cartItems.map((item, i) => (
              <li key={`${item.id}-${item.size}-${i}`} className="cart__item">
                <Link to={`/product/${item.id}`} className="cart__thumb">
                  <Img src={item.image || item.images?.[0]} alt={item.name} sizes="140px" fill />
                </Link>
                <div className="cart__item-main">
                  <div className="cart__item-top">
                    <Link to={`/product/${item.id}`} className="cart__item-name">{item.name}</Link>
                    <p className="cart__item-price">{eur(item.price * item.quantity)}</p>
                  </div>

                  <p className="cart__item-meta">
                    {[item.category, item.size && `EU ${item.size}`].filter(Boolean).join(' · ')}
                  </p>

                  <div className="cart__item-actions">
                    <div className="cart__qty" aria-label="Quantity">
                      <button onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)} aria-label="Decrease quantity">−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)} aria-label="Increase quantity">+</button>
                    </div>
                    <button className="cart__remove" onClick={() => removeFromCart(item.id, item.size)}>Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="cart__summary">
            <h2 className="cart__sum-title">Order summary</h2>
            <div className="cart__sum-rows">
              <div className="cart__sum-row"><span>Subtotal</span><span>{eur(subtotal)}</span></div>
              <div className="cart__sum-row"><span>Shipping</span><span className="u-muted">Calculated at checkout</span></div>
            </div>
            <div className="cart__sum-row cart__sum-row--total"><span>Estimated total</span><span>{eur(subtotal)}</span></div>

            <button className="btn btn--block cart__checkout" onClick={() => navigate('/checkout')}>
              Proceed to checkout
            </button>

            <ul className="cart__assure">
              <li>Complimentary delivery across Kosovo &amp; the region</li>
              <li>14-day returns</li>
              <li>Final total confirmed at checkout</li>
            </ul>
          </aside>
        </div>

        {products.length > 0 && (
          <section className="section section--tight cart__more">
            <div className="section-head">
              <p className="u-eyebrow">The Collection</p>
              <Link to="/products" className="link-underline link-quiet">All heels</Link>
            </div>
            <ProductGrid products={products.filter((p) => !cartItems.some((c) => c.id === p.id)).slice(0, 4)} cols={4} />
          </section>
        )}
      </div>
    </div>
  );
};

export default Cart;
