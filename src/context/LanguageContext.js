import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../translations';

const LanguageContext = createContext();

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        // Check localStorage for saved language preference, default to 'en'
        const savedLocal = localStorage.getItem('bukur_language');
        return savedLocal || 'en';
    });

    useEffect(() => {
        localStorage.setItem('bukur_language', language);
    }, [language]);

    // Translation function
    const t = (key) => {
        // If we have an exact match in our dictionary
        if (translations[language] && translations[language][key]) {
            return translations[language][key];
        }
        // Fallback to the original key if not found
        return key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};
