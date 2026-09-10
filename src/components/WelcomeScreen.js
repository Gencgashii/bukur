import React, { useEffect, useState } from 'react';
import logo from '../assets/bukur-logo.png';
import './WelcomeScreen.css';

const SEEN_KEY = 'bukur-welcome-seen';

const wasSeen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true; // if storage is unavailable, don't gate the site
  }
};

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const HOLD_MS = 1300; // the monogram sits composed (~1.3s) before the gate parts
const OPEN_MS = 950; // the gate swings apart

/**
 * BUKUR WORLD opening — a one-time (per session) brand moment: the BB monogram
 * holds on an ivory field, then the field splits down the seam and the two
 * halves draw apart like a gate, revealing the store. No language choice, no
 * interaction required. Click / key / scroll skips straight to the opening.
 * Honours prefers-reduced-motion (shown once, no animation).
 */
export default function WelcomeScreen() {
  const [phase, setPhase] = useState(() => {
    if (wasSeen() || prefersReduced()) return 'done';
    return 'hold';
  });

  useEffect(() => {
    if (phase === 'done') {
      try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
      return undefined;
    }
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }

    const open = setTimeout(() => setPhase('opening'), HOLD_MS);
    let done = setTimeout(() => setPhase('done'), HOLD_MS + OPEN_MS);

    const skip = () => {
      clearTimeout(open);
      clearTimeout(done);
      setPhase('opening');
      done = setTimeout(() => setPhase('done'), OPEN_MS);
    };
    const once = { once: true };
    window.addEventListener('pointerdown', skip, once);
    window.addEventListener('keydown', skip, once);
    window.addEventListener('wheel', skip, { once: true, passive: true });

    return () => {
      clearTimeout(open);
      clearTimeout(done);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('wheel', skip);
    };
    // run once for the lifetime of the splash
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      className={`welcome ${phase === 'opening' ? 'is-opening' : ''}`}
      role="presentation"
      aria-hidden="true"
    >
      <div className="welcome__panel welcome__panel--l" style={{ backgroundImage: `url(${logo})` }} />
      <div className="welcome__panel welcome__panel--r" style={{ backgroundImage: `url(${logo})` }} />
      <div className="welcome__mark">
        <span className="welcome__wordmark">BUKUR WORLD</span>
        <span className="welcome__place">Est. Prishtina</span>
      </div>
    </div>
  );
}
