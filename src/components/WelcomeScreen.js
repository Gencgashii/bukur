import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './WelcomeScreen.css';

const SEEN_KEY = 'bukur-welcome-seen';

const wasSeen = () => {
  try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
};

const WelcomeScreen = () => {
  const { setLanguage } = useLanguage();
  const [visible, setVisible] = useState(!wasSeen());
  const [leaving, setLeaving] = useState(false);

  const choose = (lang) => {
    setLanguage(lang);
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    setLeaving(true);
    setTimeout(() => setVisible(false), 700);
  };

  if (!visible) return null;

  return (
    <div className={`welcome ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-label="Choose language">
      <div className="welcome__rule welcome__rule--top" aria-hidden="true" />
      <div className="welcome__inner">
        <p className="u-eyebrow">Est. Prishtina</p>
        <h1 className="welcome__wordmark">BUKUR WORLD</h1>
        <p className="welcome__tag">Sculptural heels, made for the entrance</p>
        <div className="welcome__langs">
          <button onClick={() => choose('en')} aria-label="Enter in English">English</button>
          <span aria-hidden="true">/</span>
          <button onClick={() => choose('sq')} aria-label="Hyr në shqip">Shqip</button>
        </div>
      </div>
      <div className="welcome__rule welcome__rule--bottom" aria-hidden="true" />
    </div>
  );
};

export default WelcomeScreen;
