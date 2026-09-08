import React from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../context/ProductsContext';
import usePageMeta from '../hooks/usePageMeta';
import ProductGrid from '../components/ProductGrid';
import EditorialSplit from '../components/EditorialSplit';
import ShopByCategory from '../components/ShopByCategory';
import Reveal from '../components/Reveal';
import Img from '../components/Img';
import './Home.css';

const HERO_IMAGE = '/media/campaign-spotlight.jpg';

const Home = () => {
  const { products, loading } = useProducts();
  usePageMeta(null, 'BUKUR WORLD — sculptural heels, designed in Prishtina. Discover the new collection of slingbacks, pumps and statement heels.');

  const newArrivals = products.filter((p) => p.newArrival).slice(0, 4);
  const arrivals = (newArrivals.length ? newArrivals : products).slice(0, 4);
  const featured = products.filter((p) => p.featured).slice(0, 3);
  const signature = (featured.length ? featured : products).slice(0, 3);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero__media">
          <Img src={HERO_IMAGE} alt="BUKUR WORLD — the new collection" sizes="100vw" priority fill />
        </div>
        <div className="hero__inner">
          <p className="u-eyebrow hero__kicker">BUKUR WORLD</p>
          <h1 className="hero__title">Made for the entrance.</h1>
          <Link to="/products" className="btn btn--light">Discover the collection</Link>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div className="section-head__title">
              <p className="u-eyebrow">The First Edit</p>
              <h2 className="u-title">New arrivals</h2>
            </div>
            <Link to="/products?sort=new" className="link-underline link-quiet">View all</Link>
          </div>
          {loading && !products.length ? (
            <div className="pgrid pgrid--4">
              {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton sk-card" />)}
            </div>
          ) : (
            <ProductGrid products={arrivals} cols={4} priorityCount={2} />
          )}
        </div>
      </section>

      <EditorialSplit
        eyebrow="The Signature"
        title="The bow, reimagined."
        body="A pointed satin slingback with a hand-folded bow and the BUKUR monogram. Floral-embroidered, quietly precise — the house's defining silhouette."
        cta={{ to: '/products?category=Slingbacks', label: 'Explore slingbacks' }}
        media={{ type: 'image', src: '/media/bow-slingback-trio.jpg', alt: 'BUKUR Signature Bow Slingback in blush, black and periwinkle' }}
      />

      <ShopByCategory products={products} />

      <EditorialSplit
        flip
        dark
        eyebrow="Statement"
        title="Sculpture for the foot."
        body="Draped tulle set on the openwork BUKUR heel. An evening shoe built like an object — meant to be looked at twice."
        cta={{ to: '/products?category=Statement', label: 'See the statement edit' }}
        media={{ type: 'image', src: '/media/veil-mesh-trio.jpg', alt: 'BUKUR Veil Mesh Pump in rouge, ivory and black' }}
      />

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div className="section-head__title">
              <p className="u-eyebrow">The House</p>
              <h2 className="u-title">Signature styles</h2>
            </div>
            <Link to="/products" className="link-underline link-quiet">All heels</Link>
          </div>
          <ProductGrid products={signature} cols={3} />
        </div>
      </section>

      <section className="section section--tight statement" id="about">
        <div className="container container--narrow">
          <Reveal>
            <p className="u-eyebrow" style={{ textAlign: 'center' }}>Est. Prishtina</p>
            <h2 className="u-title" style={{ margin: '1.25rem 0' }}>Designed in Prishtina. Made to be remembered.</h2>
            <p className="u-lede">
              BUKUR is a modern luxury footwear house from Kosovo. Every silhouette is drawn with a
              sculptural instinct — considered proportions, a confident heel, and details you notice
              on the second look.
            </p>
            <p style={{ marginTop: '1.75rem' }}>
              <Link to="/about" className="link-underline">Read the house story</Link>
            </p>
          </Reveal>
        </div>
      </section>

      <section className="campaign">
        <Img src="/media/monogram-mesh-hero.jpg" alt="BUKUR Monogram Mesh Slingback" sizes="100vw" fill />
        <div className="campaign__inner">
          <p className="u-eyebrow" style={{ color: 'var(--on-dark)' }}>The Collection</p>
          <h2 className="u-display" style={{ color: 'var(--on-dark)' }}>Enter BUKUR&nbsp;WORLD</h2>
          <Link to="/products" className="btn btn--light">Shop all heels</Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
