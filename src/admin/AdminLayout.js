import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../assets/bukur-logo.png';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/inventory', label: 'Inventory' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/payments', label: 'Payments' },
  { to: '/admin/settings', label: 'Store Settings' },
];

const isDev = process.env.NODE_ENV !== 'production';

export default function AdminLayout({ admin, onLogout, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ad-shell ${open ? 'ad-shell--nav-open' : ''}`}>
      <aside className="ad-sidebar">
        <div className="ad-brand"><img src={logo} alt="BUKUR" width="189" height="189" /></div>
        <nav className="ad-nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `ad-nav__link ${isActive ? 'is-active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="ad-main">
        <header className="ad-header">
          <button className="ad-burger" aria-label="Toggle navigation" onClick={() => setOpen((v) => !v)}>≡</button>
          <div className="ad-header__title">Store Management</div>
          <div className="ad-header__right">
            {isDev && <span className="ad-env">DEV</span>}
            <span className="ad-who">{admin?.email}</span>
            <button className="ad-btn ad-btn--ghost" onClick={onLogout}>Log out</button>
          </div>
        </header>
        <main className="ad-content">{children}</main>
      </div>

      {open && <div className="ad-scrim" onClick={() => setOpen(false)} />}
    </div>
  );
}
