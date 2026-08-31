import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import './Footer.css';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3 className="footer-title">BUKUR</h3>
          <p className="footer-text">
            {t('Clothing brand from Kosovo.')}<br />
            {t('Minimalist design. Maximum style.')}
          </p>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">{t('Quick Links')}</h4>
          <ul className="footer-links">
            <li><a href="/">{t('Home')}</a></li>
            <li><a href="/products">{t('Products')}</a></li>
            <li><a href="/cart">{t('Cart')}</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">{t('Contact')}</h4>
          <ul className="footer-links">
            <li>Kosovo</li>
            <li>info@bukur.co</li>
            <li>+383 49 123 456</li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">{t('Follow Us')}</h4>
          <div className="social-links">
            <a href="https://www.instagram.com/bukur.co/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">Instagram</a>
            <a href="https://www.facebook.com/bukur.co" target="_blank" rel="noopener noreferrer" aria-label="Facebook">Facebook</a>
            <a href="https://www.tiktok.com/@bukur.co" target="_blank" rel="noopener noreferrer" aria-label="TikTok">Tik Tok</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} BUKUR®. {t('ALL RIGHTS RESERVED.')}</p>
      </div>
    </footer>
  );
};

export default Footer;
