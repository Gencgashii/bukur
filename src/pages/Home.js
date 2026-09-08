import React from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../context/ProductsContext';
import usePageMeta from '../hooks/usePageMeta';
import ProductGrid from '../components/ProductGrid';
import EditorialSplit from '../components/EditorialSplit';
import ShopByCategory from '../components/ShopByCategory';
import Reveal from '../components/Reveal';
import Img from '../components/Img';
import homeContent from '../content/home';
import './Home.css';

const Home = () => {
  const { products, loading } = useProducts();
  usePageMeta(
    null,
    'BUKUR WORLD — sculptural heels, designed in Prishtina. Discover the new collection of slingbacks, pumps and statement heels.'
  );

  const c = homeContent;

  const newArrivals = products.filter((p) => p.newArrival).slice(0, 4);
  const arrivals = (newArrivals.length ? newArrivals : products).slice(0, 4);

  const [ed1, ed2] = c.editorials;

  return (
    <div className="home">
      {/* 1 — HERO ------------------------------------------------------------- */}
      <section className="hero">
        <div className="hero__media">
          <Img src={c.hero.image} alt={c.hero.alt} sizes="100vw" priority fill imgClassName="media-drift" />
        </div>
        <div className="hero__inner">
          <p className="u-eyebrow hero__kicker">{c.hero.eyebrow}</p>
          <h1 className="hero__title">{c.hero.title}</h1>
          <Link to={c.hero.cta.to} className="btn btn--light hero__cta">{c.hero.cta.label}</Link>
        </div>
        <span className="hero__scroll" aria-hidden="true">Scroll</span>
      </section>

      {/* 2 — one quiet brand line, lots of air ------------------------------ */}
      <section className="brandline container container--narrow">
        <Reveal className="reveal--soft">
          <h2 className="u-title">{c.brandStatement}</h2>
        </Reveal>
      </section>

      {/* 3 — editorial: the signature ------------------------------------- */}
      <EditorialSplit
        eyebrow={ed1.eyebrow}
        title={ed1.title}
        body={ed1.body}
        cta={ed1.cta}
        media={{ type: 'image', ...ed1.media }}
        wide={ed1.wide}
      />

      {/* 4 — the first edit (product-driven) ------------------------------- */}
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

      {/* 5 — full-bleed daylight beat ------------------------------------- */}
      <section className={`editorial-full ${c.editorialFull.align === 'center' ? 'editorial-full--center' : ''}`}>
        <Img src={c.editorialFull.image} alt={c.editorialFull.alt} sizes="100vw" fill imgClassName="media-drift" />
        <div className="editorial-full__inner">
          <p className="u-eyebrow" style={{ color: 'var(--on-dark)' }}>{c.editorialFull.eyebrow}</p>
          <h2 className="u-display u-display--light" style={{ color: 'var(--on-dark)' }}>{c.editorialFull.title}</h2>
        </div>
      </section>

      {/* 6 — shop by silhouette (art-directed, stable) ------------------- */}
      <ShopByCategory categories={c.categories} products={products} />

      {/* 7 — editorial: statement -------------------------------------- */}
      <EditorialSplit
        eyebrow={ed2.eyebrow}
        title={ed2.title}
        body={ed2.body}
        cta={ed2.cta}
        media={{ type: 'image', ...ed2.media }}
        flip={ed2.flip}
        dark={ed2.dark}
        wide={ed2.wide}
      />

      {/* 8 — the house ------------------------------------------------- */}
      <section className="section section--tight statement" id="about">
        <div className="container container--narrow">
          <Reveal className="reveal--soft">
            <p className="u-eyebrow u-center">{c.house.eyebrow}</p>
            <h2 className="u-title" style={{ marginBlock: '1.25rem' }}>{c.house.title}</h2>
            <p className="u-lede">{c.house.body}</p>
            <p style={{ marginTop: '1.9rem' }}>
              <Link to={c.house.cta.to} className="link-underline">{c.house.cta.label}</Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* 9 — campaign band ------------------------------------------- */}
      <section className="campaign">
        <Img src={c.campaign.image} alt={c.campaign.alt} sizes="100vw" fill imgClassName="media-drift" />
        <div className="campaign__inner">
          <p className="u-eyebrow" style={{ color: 'var(--on-dark)' }}>{c.campaign.eyebrow}</p>
          <h2 className="u-display u-display--light" style={{ color: 'var(--on-dark)' }}>{c.campaign.title}</h2>
          <Link to={c.campaign.cta.to} className="btn btn--outline-light">{c.campaign.cta.label}</Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
