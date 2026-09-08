import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './PdpDrawer.css';

/**
 * Right-hand slide-in panel used for the product-detail sub-content
 * (Details / Sizing / Shipping). Scrim, Escape to close, body scroll lock.
 */
const PdpDrawer = ({ open, onClose, title, children }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return createPortal(
    <div className={`pdp-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="pdp-drawer__scrim" onClick={onClose} />
      <aside className="pdp-drawer__panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="pdp-drawer__head">
          <span className="pdp-drawer__title">{title}</span>
          <button className="pdp-drawer__close" onClick={onClose}>Close</button>
        </div>
        <div className="pdp-drawer__body">{children}</div>
      </aside>
    </div>,
    document.body
  );
};

export default PdpDrawer;
