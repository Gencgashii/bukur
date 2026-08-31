import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './WelcomeScreen.css';

const WelcomeScreen = () => {
    const { setLanguage } = useLanguage();
    const [isVisible, setIsVisible] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);

    const handleSelectLanguage = (lang) => {
        setLanguage(lang);
        setIsFadingOut(true);
        setTimeout(() => {
            setIsVisible(false);
        }, 800);
    };

    if (!isVisible) return null;

    return (
        <div className={`welcome-screen ${isFadingOut ? 'fade-out' : ''}`}>
            <div className="welcome-grain" aria-hidden="true" />
            <div className="welcome-rule welcome-rule-top" aria-hidden="true" />
            <div className="welcome-rule welcome-rule-bottom" aria-hidden="true" />
            <div className="welcome-content">
                <p className="welcome-kicker">EST. PRISHTINA</p>
                <h1 className="welcome-title" aria-label="BUKUR">BUKUR</h1>
                <p className="welcome-subtitle">TIMELESS PIECES DESIGNED FOR MODERN ELEGANCE</p>
                <div className="welcome-lang-selector">
                    <button 
                        className="welcome-lang-btn" 
                        onClick={() => handleSelectLanguage('en')}
                        aria-label="Enter BUKUR in English"
                    >
                        ENGLISH
                    </button>
                    <span className="welcome-lang-divider">|</span>
                    <button 
                        className="welcome-lang-btn" 
                        onClick={() => handleSelectLanguage('sq')}
                        aria-label="Hyr në BUKUR në shqip"
                    >
                        SHQIP
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WelcomeScreen;
