import React, { useState } from 'react';
import usePageMeta from '../hooks/usePageMeta';
import Reveal from '../components/Reveal';
import faqGroups, { faqContact } from '../content/faq';
import './FAQ.css';

const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? 'is-open' : ''}`}>
      <button className="faq-item__q" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{q}</span>
        <span className="faq-item__sign" aria-hidden="true">{open ? '–' : '+'}</span>
      </button>
      <div className="faq-item__wrap">
        <div className="faq-item__a">
          <p>{a}</p>
        </div>
      </div>
    </div>
  );
};

const FAQ = () => {
  usePageMeta(
    'FAQ',
    'Answers on BUKUR WORLD orders, shipping, returns, payment, sizing and care.'
  );

  return (
    <div className="faq">
      <div className="container container--narrow">
        <header className="faq__head">
          <Reveal className="reveal--soft">
            <p className="u-eyebrow">Client care</p>
            <h1 className="u-display u-display--light">Frequently asked questions</h1>
          </Reveal>
        </header>

        {faqGroups.map((group) => (
          <section className="faq__group" key={group.title}>
            <h2 className="faq__group-title">{group.title}</h2>
            <div className="faq__list">
              {group.items.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </section>
        ))}

        <section className="faq__contact">
          <p className="u-eyebrow u-center">{faqContact.eyebrow}</p>
          <h2 className="u-title u-center" style={{ marginBlock: '1rem' }}>{faqContact.title}</h2>
          <p className="u-lede u-center" style={{ marginInline: 'auto' }}>{faqContact.body}</p>
          <p className="u-center" style={{ marginTop: '1.5rem' }}>
            <a href={`mailto:${faqContact.email}`} className="link-underline">{faqContact.email}</a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default FAQ;
