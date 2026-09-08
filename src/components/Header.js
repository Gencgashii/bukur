import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import logo from '../assets/bukur-logo.png';
import './Header.css';

const NAV = [
  { to: '/products', label: 'Shop', end: false },
  { to: '/products?sort=new', label: 'New In' },
  { to: '/products?category=Slingbacks', label: 'Collections' },
  { to: '/about', label: 'About' },
];

const Header = () => {
  const { getCartItemsCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const overHero = location.pathname === '/';

  const [solid, setSolid] = useState(!overHero);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');

  useEffect(() => {
    setSolid(!overHero);
    if (!overHero) return undefined;
    const onScroll = () => setSolid(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.body.style.overflow = menuOpen || searchOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen, searchOpen]);

  const submitSearch = (e) => {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
    setSearchOpen(false);
    setTerm('');
  };

  const count = getCartItemsCount();

  return (
    <header className={`hdr ${solid ? 'is-solid' : ''} ${overHero ? '' : 'is-plain'}`}>
      <div className="hdr__bar">Complimentary delivery across Kosovo &amp; the region</div>
      <div className="hdr__inner">
        <nav className="hdr__nav hdr__nav--left" aria-label="Primary">
          <button className="hdr__burger" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <span /><span /><span />
          </button>
          {NAV.slice(0, 2).map((n) => (
            <NavLink key={n.label} to={n.to} className="hdr__link">{n.label}</NavLink>
          ))}
        </nav>

        <Link to="/" className="hdr__wordmark" aria-label="BUKUR WORLD home">
          <img src={logo} alt="BUKUR" className="hdr__logo" width="189" height="189" />
        </Link>

        <nav className="hdr__nav hdr__nav--right" aria-label="Utilities">
          <button className="hdr__link hdr__search-btn" onClick={() => setSearchOpen(true)} aria-label="Search">Search</button>
          <Link to="/cart" className="hdr__link hdr__bag" aria-label={`Bag, ${count} item${count === 1 ? '' : 's'}`}>
            Bag{count > 0 && <span className="hdr__bag-count"><span>{count}</span></span>}
          </Link>
        </nav>
      </div>

      {/* mobile / full nav overlay */}
      <div className={`overlay ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
        <div className="overlay__top">
          <span className="hdr__wordmark"><img src={logo} alt="BUKUR" className="hdr__logo" width="189" height="189" /></span>
          <button className="overlay__close" onClick={() => setMenuOpen(false)}>Close</button>
        </div>
        <nav className="overlay__nav">
          {NAV.map((n) => (
            <Link key={n.label} to={n.to}>{n.label}</Link>
          ))}
          <Link to="/cart">Bag{count > 0 ? ` (${count})` : ''}</Link>
        </nav>
        <div className="overlay__foot u-fine">
          <span>Prishtina</span><span>Est. 2026</span>
        </div>
      </div>

      {/* search overlay */}
      <div className={`overlay ${searchOpen ? 'is-open' : ''}`} aria-hidden={!searchOpen}>
        <div className="overlay__top">
          <span className="u-fine">Search</span>
          <button className="overlay__close" onClick={() => setSearchOpen(false)}>Close</button>
        </div>
        <form className="overlay__search" onSubmit={submitSearch} style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <input
            autoFocus={searchOpen}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search the collection"
            aria-label="Search the collection"
          />
          <button type="submit" className="link-underline">Go</button>
        </form>
      </div>
    </header>
  );
};

export default Header;
