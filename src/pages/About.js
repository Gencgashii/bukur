import React from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import Reveal from '../components/Reveal';
import EditorialSplit from '../components/EditorialSplit';
import Img from '../components/Img';
import './About.css';

const About = () => {
  usePageMeta('About', 'BUKUR WORLD is a modern luxury footwear house from Prishtina, Kosovo — sculptural heels drawn with a confident instinct.');

  return (
    <div className="about">
      <section className="about__hero">
        <Img src="/media/lookbook-daylight.jpg" alt="BUKUR WORLD collection" sizes="100vw" priority fill />
        <div className="about__hero-inner container">
          <p className="u-eyebrow" style={{ color: 'var(--ink)' }}>Est. Prishtina</p>
          <h1 className="u-display u-display--light">The house of BUKUR</h1>
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          <Reveal>
            <p className="u-lede" style={{ fontSize: 'clamp(1.15rem, 1.8vw, 1.4rem)' }}>
              BUKUR is a modern luxury footwear house from Kosovo. We make heels the way a sculptor
              works a form — proportion first, then the detail you only notice on the second look.
            </p>
            <p className="u-lede" style={{ marginTop: '1.5rem' }}>
              Each silhouette begins in Prishtina and is built to move through the world: a confident
              heel, a precise toe, an ankle strap that holds. Nothing decorative for its own sake.
            </p>
          </Reveal>
        </div>
      </section>

      <EditorialSplit
        eyebrow="The Craft"
        title="Considered, not loud."
        body="Satin and tulle, embroidered vamps, the openwork BUKUR heel. Our materials are chosen for how they age, and our lasts are refined until the shoe disappears on the foot."
        cta={{ to: '/products', label: 'Explore the collection' }}
        media={{ type: 'image', src: '/media/veil-mesh-trio.jpg', alt: 'BUKUR Veil Mesh Pump' }}
      />

      <section className="section statement">
        <div className="container container--narrow">
          <Reveal>
            <p className="u-eyebrow" style={{ textAlign: 'center' }}>The Invitation</p>
            <h2 className="u-title" style={{ marginBlock: '1.25rem' }}>Made for the entrance.</h2>
            <p style={{ textAlign: 'center' }}>
              <Link to="/products" className="btn btn--ghost">Shop all heels</Link>
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default About;
