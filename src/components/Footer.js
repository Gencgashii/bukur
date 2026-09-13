import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import logo from '../assets/bukur-logo.png';
import './Footer.css';

const newsletterApi = `${API_URL.replace(/\/$/, '')}/store/custom/newsletter`;

const Footer = () => {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <footer className="ft">
      <div className="ft__inner">
        <div className="ft__brand">
          <Link to="/" className="ft__brand-mark" aria-label="BUKUR WORLD home">
            <img src={logo} alt="BUKUR" width="189" height="189" />
          </Link>
          <p className="ft__brand-line">
            A luxury footwear house from Prishtina. Sculptural heels for the moments worth remembering.
          </p>
          <p className="ft__brand-place">Est. 2026 · Prishtina, Kosovo</p>
        </div>

        <nav className="ft__col" aria-label="Shop">
          <h4>Shop</h4>
          <Link to="/products">All heels</Link>
          <Link to="/products?category=All%20eyes%20on%20me">All eyes on me</Link>
          <Link to="/products?category=Diva">Diva</Link>
          <Link to="/products?category=Icon">Icon</Link>
          <Link to="/products?category=Aura">Aura</Link>
          <Link to="/products?category=Timeless">Timeless</Link>
          <Link to="/products">&amp; more</Link>
        </nav>

        <nav className="ft__col" aria-label="The house">
          <h4>The House</h4>
          <Link to="/about">About BUKUR</Link>
          <Link to="/products?sort=new">New arrivals</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/contact">Contact</Link>
        </nav>

        <nav className="ft__col" aria-label="Connect">
          <h4>Connect</h4>
          <a href="https://www.instagram.com/bukurworld/" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="https://www.tiktok.com/@bukur.world" target="_blank" rel="noopener noreferrer">TikTok</a>
          <a href="https://www.facebook.com/bukurworld/" target="_blank" rel="noopener noreferrer">Facebook</a>
          <span>Prishtina, Kosovo</span>
        </nav>

        <div className="ft__news">
          <p className="u-fine" style={{ color: '#bcb3a4' }}>The BUKUR Letter</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const value = email.trim();
              if (!value || busy || done) return;
              setBusy(true);
              setError('');
              try {
                const res = await fetch(newsletterApi, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: value }),
                });
                if (!res.ok) throw new Error();
                setDone(true);
              } catch {
                setError('Something went wrong. Please try again.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="sr-only" htmlFor="ft-email">Email address</label>
            <input
              id="ft-email"
              type="email"
              autoComplete="email"
              placeholder={done ? 'Thank you — you are on the list' : 'Email address'}
              value={done ? '' : email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={done || busy}
              required
            />
            <button type="submit" disabled={done || busy}>{done ? '✓' : busy ? '…' : 'Subscribe'}</button>
          </form>
          {error && <p className="ft__news-err">{error}</p>}
        </div>
      </div>

      <div className="ft__legal">
        <span>© {new Date().getFullYear()} Bukur World SHPK · Prishtina, Kosovo</span>
        <Link to="/terms">Terms &amp; Conditions</Link>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/cookies">Cookies Policy</Link>
        <span>All rights reserved</span>
      </div>
    </footer>
  );
};

export default Footer;
