import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useFocusTrap from '../hooks/useFocusTrap';
import './PdpDrawer.css';

/**
 * Right-hand slide-in panel used for the product-detail sub-content
 * (Details / Sizing / Shipping). Scrim, Escape to close, body scroll lock,
 * focus trap + focus return.
 */
const PdpDrawer = ({ open, onClose, title, children }) => {
  const panelRef = useRef(null);
  useFocusTrap({ active: open, ref: panelRef, onEscape: onClose });

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return createPortal(
    <div className={`pdp-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="pdp-drawer__scrim" onClick={onClose} />
      <aside
        className="pdp-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
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
