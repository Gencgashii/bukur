import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Img from './Img';
import './ProductGallery.css';

const STACK_SIZES = '(max-width: 900px) 100vw, 50vw';

const ProductGallery = ({ images = [], alt = '' }) => {
  const list = images.filter(Boolean);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(-1);
  const trackRef = useRef(null);

  useEffect(() => {
    if (lightbox < 0) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(-1);
      if (e.key === 'ArrowRight') setLightbox((i) => (i + 1) % list.length);
      if (e.key === 'ArrowLeft') setLightbox((i) => (i - 1 + list.length) % list.length);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [lightbox, list.length]);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(list.length - 1, idx)));
  };

  if (!list.length) return <div className="gal gal--empty" aria-hidden="true" />;

  return (
    <div className="gal">
      {/* desktop: a vertical stack of full-width frames that scroll with the page */}
      <div className="gal__stack">
        {list.map((src, i) => (
          <button
            key={i}
            type="button"
            className="gal__frame"
            onClick={() => setLightbox(i)}
            aria-label={`Enlarge image ${i + 1}`}
          >
            <Img
              src={src}
              alt={i === 0 ? alt : `${alt} — view ${i + 1}`}
              sizes={STACK_SIZES}
              priority={i === 0}
              fill
            />
          </button>
        ))}
      </div>

      {/* mobile: swipe carousel */}
      <div className="gal__carousel">
        <div className="gal__track" ref={trackRef} onScroll={onScroll}>
          {list.map((src, i) => (
            <div className="gal__slide" key={i}>
              <Img src={src} alt={i === 0 ? alt : `${alt} — view ${i + 1}`} sizes="100vw" priority={i === 0} fill />
            </div>
          ))}
        </div>
        {list.length > 1 && (
          <div className="gal__dots">
            {list.map((_, i) => (
              <span key={i} className={`gal__dot ${i === active ? 'is-on' : ''}`} />
            ))}
          </div>
        )}
      </div>

      {lightbox >= 0 && createPortal(
        <div className="gal-lb" onClick={() => setLightbox(-1)}>
          <button className="gal-lb__close" onClick={() => setLightbox(-1)} aria-label="Close">Close</button>
          <Img
            src={list[lightbox]}
            alt={alt}
            sizes="92vw"
            priority
            ratio={null}
            className="gal-lb__img"
            onClick={(e) => e.stopPropagation()}
          />
          {list.length > 1 && (
            <div className="gal-lb__nav" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setLightbox((i) => (i - 1 + list.length) % list.length)} aria-label="Previous">‹</button>
              <span>{lightbox + 1} / {list.length}</span>
              <button onClick={() => setLightbox((i) => (i + 1) % list.length)} aria-label="Next">›</button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProductGallery;
