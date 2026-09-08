import React from 'react';
import { Navigate } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import Reveal from '../components/Reveal';
import { legalDocs } from '../content/legal';
import './LegalPage.css';

const LegalPage = ({ doc }) => {
  const data = legalDocs[doc];
  usePageMeta(data ? data.title : 'Legal', data ? data.intro : undefined);

  if (!data) return <Navigate to="/" replace />;

  return (
    <div className="legal">
      <div className="container container--narrow">
        <header className="legal__head">
          <Reveal className="reveal--soft">
            <p className="u-eyebrow">Legal</p>
            <h1 className="u-display u-display--light">{data.title}</h1>
            <p className="legal__updated">Last updated {data.updated}</p>
          </Reveal>
        </header>

        {data.intro && <p className="legal__intro">{data.intro}</p>}

        {data.sections.map((section) => (
          <section className="legal__section" key={section.heading}>
            <h2 className="legal__heading">{section.heading}</h2>
            {section.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
};

export default LegalPage;
