import React from 'react';
import { Link } from 'react-router-dom';
import mensBanner from '../assets/mens_banner.png';
import womensBanner from '../assets/womens_banner.png';
import './GenderCategories.css';

const GenderCategories = () => {
    return (
        <section className="gender-categories-section">
            <div className="gender-categories-container">

                <Link to="/products?gender=Men" className="gender-card">
                    <div className="gender-image-wrapper">
                        <img src="https://www.bukur.co/_next/image?url=%2Fimages%2Fcollections%2FmenCover.webp&w=1920&q=75" alt="Men's Collection" />
                    </div>
                    <div className="gender-footer">
                        <span className="gender-title">Men</span>
                    </div>
                </Link>

                <Link to="/products?gender=Women" className="gender-card">
                    <div className="gender-image-wrapper">
                        <img src="https://www.bukur.co/_next/image?url=%2Fimages%2Fcollections%2Ffemale.webp&w=1920&q=75" alt="Women's Collection" />
                    </div>
                    <div className="gender-footer">
                        <span className="gender-title">Women</span>
                    </div>
                </Link>

            </div>
        </section>
    );
};

export default GenderCategories;
