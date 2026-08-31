import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import './Header.css';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { getCartItemsCount } = useCart();
  const { t } = useLanguage();

  const handleCloseMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
      <div className="header-container">

        {/* Left Side Navigation */}
        <nav className="nav-group nav-left">
          <Link to="/" className="nav-link" onClick={handleCloseMenu}>
            {t('Home')}
          </Link>
          <Link to="/products" className="nav-link" onClick={handleCloseMenu}>
            {t('Collection')}
          </Link>
        </nav>

        {/* Centered Logo */}
        <div className="logo-container">
          <Link to="/" className="logo" onClick={handleCloseMenu}>
            BUKUR
          </Link>
        </div>

        {/* Right Side Navigation */}
        <nav className="nav-group nav-right">
          <Link to="/cart" className="nav-link cart-link" onClick={handleCloseMenu}>
            {t('Cart')}
            {getCartItemsCount() > 0 && (
              <span className="cart-badge">{getCartItemsCount()}</span>
            )}
          </Link>

          <button className="menu-toggle-desktop" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? t('CLOSE') : t('MENU')}
          </button>
        </nav>

        {/* Mobile Hamburger (Only visible on small screens) */}
        <button
          className="menu-toggle-mobile"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`hamburger ${isMenuOpen ? 'hamburger-open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>

        {/* Mobile Flyout Menu */}
        <div className={`mobile-menu ${isMenuOpen ? 'mobile-menu-open' : ''}`}>
          <Link to="/" className="nav-link" onClick={handleCloseMenu}>{t('Home')}</Link>
          <Link to="/products" className="nav-link" onClick={handleCloseMenu}>{t('Collection')}</Link>
          <Link to="/cart" className="nav-link" onClick={handleCloseMenu}>{t('Cart')}</Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
