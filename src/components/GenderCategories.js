import React from 'react';
import { Link } from 'react-router-dom';
import './GenderCategories.css';

const GenderCategories = () => {
    return (
        <section className="gender-categories-section">
            <div className="gender-categories-container">

                <Link to="/products?category=Statement" className="gender-card">
                    <div className="gender-image-wrapper">
                        <img src="/hero_heels.png" alt="Statement heels" />
                    </div>
                    <div className="gender-footer">
                        <span className="gender-title">Statement</span>
                    </div>
                </Link>

                <Link to="/products?category=Pumps" className="gender-card">
                    <div className="gender-image-wrapper">
                        <img src="/aurelia_pump.png" alt="Pumps collection" />
                    </div>
                    <div className="gender-footer">
                        <span className="gender-title">Pumps</span>
                    </div>
                </Link>

            </div>
        </section>
    );
};

export default GenderCategories;
