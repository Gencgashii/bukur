import React from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import Reveal from '../components/Reveal';
import EditorialSplit from '../components/EditorialSplit';
import Img from '../components/Img';
import aboutContent from '../content/about';
import './About.css';

const About = () => {
  usePageMeta(
    'About',
    'BUKUR WORLD is a modern luxury footwear house from Prishtina, Kosovo — sculptural heels drawn with a confident instinct, made in small runs and finished by hand.'
  );

  const c = aboutContent;

  return (
    <div className="about">
      {/* hero ----------------------------------------------------------- */}
      <section className="about__hero">
        <Img src={c.hero.image} alt={c.hero.alt} sizes="100vw" priority fill imgClassName="media-drift" />
        <div className="about__hero-inner container">
          <p className="u-eyebrow about__hero-eyebrow">{c.hero.eyebrow}</p>
          <h1 className="u-display u-display--light about__hero-title">{c.hero.title}</h1>
          <p className="about__hero-lede">{c.hero.lede}</p>
        </div>
      </section>

      {/* manifesto ---------------------------------------------------------- */}
      <section className="section about__manifesto">
        <div className="container container--narrow">
          <Reveal className="reveal--soft">
            {c.manifesto.map((para, i) => (
              <p key={i} className="about__manifesto-p">{para}</p>
            ))}
          </Reveal>
        </div>
      </section>

      {/* origin ----------------------------------------------------------- */}
      <EditorialSplit
        eyebrow={c.origin.eyebrow}
        title={c.origin.title}
        body={c.origin.body}
        media={{ type: 'image', ...c.origin.media }}
        wide
      />

      {/* pull quote ----------------------------------------------------- */}
      <section className="about__quote">
        <div className="container container--narrow">
          <Reveal className="reveal--soft">
            <p className="about__quote-mark" aria-hidden="true">“</p>
            <blockquote className="about__quote-text">{c.quote}</blockquote>
          </Reveal>
        </div>
      </section>

      {/* signature ---------------------------------------------------------- */}
      <EditorialSplit
        eyebrow={c.signature.eyebrow}
        title={c.signature.title}
        body={c.signature.body}
        media={{ type: 'image', ...c.signature.media }}
        flip
        dark
        wide
      />

      {/* craft ---------------------------------------------------------- */}
      <EditorialSplit
        eyebrow={c.craft.eyebrow}
        title={c.craft.title}
        body={c.craft.body}
        media={{ type: 'image', ...c.craft.media }}
        wide
      />

      {/* values ---------------------------------------------------------- */}
      <section className="section about__values-section">
        <div className="container">
          <Reveal>
            <ul className="about__values">
              {c.values.map((v) => (
                <li key={v.label} className="about__value">
                  <p className="about__value-label">{v.label}</p>
                  <p className="about__value-text">{v.text}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* closing ---------------------------------------------------------- */}
      <section className="section section--tight statement">
        <div className="container container--narrow">
          <Reveal className="reveal--soft">
            <p className="u-eyebrow u-center">{c.closing.eyebrow}</p>
            <h2 className="u-title" style={{ marginBlock: '1.25rem' }}>{c.closing.title}</h2>
            <p>
              <Link to={c.closing.cta.to} className="btn btn--ghost">{c.closing.cta.label}</Link>
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default About;
