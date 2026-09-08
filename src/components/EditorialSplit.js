import React from 'react';
import { Link } from 'react-router-dom';
import useReveal from '../hooks/useReveal';
import Img from './Img';

const MEDIA_SIZES = '(max-width: 1080px) 100vw, 55vw';

/**
 * Editorial image + copy split section.
 * media: { type: 'image' | 'video', src, poster?, alt }
 */
const EditorialSplit = ({ eyebrow, title, body, cta, media, flip = false, dark = false, priority = false }) => {
  const ref = useReveal();
  return (
    <section
      ref={ref}
      className={`editorial reveal ${flip ? 'editorial--flip' : ''} ${dark ? 'editorial--dark' : ''}`}
    >
      <div className="editorial__media">
        {media.type === 'video' ? (
          <video src={media.src} poster={media.poster} autoPlay muted loop playsInline preload="none" aria-label={media.alt} />
        ) : (
          <Img src={media.src} alt={media.alt} sizes={MEDIA_SIZES} priority={priority} fill />
        )}
      </div>
      <div className="editorial__body">
        {eyebrow && <p className="u-eyebrow">{eyebrow}</p>}
        <h2 className="u-title">{title}</h2>
        {body && <p className="u-lede">{body}</p>}
        {cta && (
          <Link to={cta.to} className="link-underline" style={{ marginTop: '0.5rem' }}>
            {cta.label}
          </Link>
        )}
      </div>
    </section>
  );
};

export default EditorialSplit;
