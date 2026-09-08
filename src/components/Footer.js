import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  return (
    <footer className="ft">
      <div className="ft__inner">
        <div className="ft__brand">
          <div className="ft__brand-name">BUKUR</div>
          <p className="ft__brand-line">
            A luxury footwear house from Prishtina. Sculptural heels for the moments worth remembering.
          </p>
        </div>

        <nav className="ft__col" aria-label="Shop">
          <h4>Shop</h4>
          <Link to="/products">All heels</Link>
          <Link to="/products?category=Slingbacks">Slingbacks</Link>
          <Link to="/products?category=Pumps">Pumps</Link>
          <Link to="/products?category=Sandals">Sandals</Link>
          <Link to="/products?category=Statement">Statement</Link>
        </nav>

        <nav className="ft__col" aria-label="The house">
          <h4>The House</h4>
          <Link to="/about">About BUKUR</Link>
          <Link to="/products?sort=new">New arrivals</Link>
          <a href="mailto:info@bukur.co">Client care</a>
        </nav>

        <nav className="ft__col" aria-label="Connect">
          <h4>Connect</h4>
          <a href="https://www.instagram.com/bukur.co/" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="https://www.tiktok.com/@bukur.co" target="_blank" rel="noopener noreferrer">TikTok</a>
          <span>Prishtina, Kosovo</span>
        </nav>

        <div className="ft__news">
          <p className="u-fine" style={{ color: '#bcb3a4' }}>The BUKUR Letter</p>
          <form
            onSubmit={(e) => { e.preventDefault(); if (email.trim()) setDone(true); }}
          >
            <label className="sr-only" htmlFor="ft-email">Email address</label>
            <input
              id="ft-email"
              type="email"
              placeholder={done ? 'Thank you — you are on the list' : 'Email address'}
              value={done ? '' : email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={done}
              required
            />
            <button type="submit" disabled={done}>{done ? '✓' : 'Subscribe'}</button>
          </form>
        </div>
      </div>

      <div className="ft__legal">
        <span>© {new Date().getFullYear()} BUKUR WORLD</span>
        <span>All rights reserved</span>
      </div>
    </footer>
  );
};

export default Footer;
