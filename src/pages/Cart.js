import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductsContext';
import usePageMeta from '../hooks/usePageMeta';
import ProductGrid from '../components/ProductGrid';
import Img from '../components/Img';
import './Cart.css';

const eur = (n) => `€${Number(n || 0).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
          <h1 className="u-display">Shopping bag</h1>
          <p className="u-fine">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</p>
        </header>

        <div className="cart__grid">
          <ul className="cart__items">
            {cartItems.map((item, i) => (
              <li key={`${item.id}-${item.size}-${i}`} className="cart__item">
                <Link to={`/product/${item.id}`} className="cart__thumb">
                  <Img src={item.image || item.images?.[0]} alt={item.name} sizes="120px" fill />
                </Link>
                <div className="cart__item-main">
                  <div className="cart__item-top">
                    <div>
                      <Link to={`/product/${item.id}`} className="cart__item-name">{item.name}</Link>
                      {item.category && <p className="u-fine u-muted" style={{ marginTop: '0.4rem' }}>{item.category}</p>}
                      {item.size && <p className="cart__item-size">Size EU {item.size}</p>}
                    </div>
                    <p className="cart__item-price">{eur(item.price * item.quantity)}</p>
                  </div>
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
            <h2 className="u-fine">Order summary</h2>
            <div className="cart__sum-row"><span>Subtotal</span><span>{eur(subtotal)}</span></div>
            <div className="cart__sum-row"><span>Shipping</span><span className="u-muted">Calculated at checkout</span></div>
            <div className="cart__sum-row cart__sum-row--total"><span>Estimated total</span><span>{eur(subtotal)}</span></div>
            <button className="btn btn--block" onClick={() => navigate('/checkout')} style={{ marginTop: '1.5rem' }}>
              Proceed to checkout
            </button>
            <Link to="/products" className="cart__continue link-underline link-quiet">Continue shopping</Link>
            <p className="cart__note">Complimentary delivery across Kosovo &amp; the region. Final total is confirmed at checkout.</p>
          </aside>
        </div>

        {products.length > 0 && (
          <section className="section section--tight">
            <div className="section-head"><h2 className="u-title">You may also like</h2></div>
            <ProductGrid products={products.filter((p) => !cartItems.some((c) => c.id === p.id)).slice(0, 3)} cols={3} />
          </section>
        )}
      </div>
    </div>
  );
};

export default Cart;
