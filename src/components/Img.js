import React from 'react';

/**
 * Responsive image.
 *
 * When `src` points at an optimised storefront asset (`/media/<slug>.jpg`),
 * renders a <picture> with AVIF + WebP srcSets across the generated widths and
 * a progressive-JPEG fallback. For any other URL (admin uploads, external
 * hosts, unknown paths) it renders a plain <img> with no variant guessing, so
 * nothing 404s.
 *
 * Variants are produced by `npm run media:optimize` (scripts/optimize-media.js).
 */

// Must mirror WIDTHS in scripts/optimize-media.js
const WIDTHS = [640, 960, 1280, 1600, 2000, 2560];
// logical key for an optimised asset — the extension is only a naming handle
const OPT_RE = /^\/media\/([a-z0-9][a-z0-9-]*)\.(?:jpe?g|png)$/i;

export default function Img({
  src,
  alt = '',
  sizes = '100vw',
  priority = false,
  eager = false,
  fill = false,
  ratio,
  className = '',
  imgClassName = '',
  ...rest
}) {
  // `alt` is applied explicitly on each <img> below (keeps jsx-a11y/alt-text
  // happy — it can't see props coming from a spread).
  //
  // `priority` and `eager` are deliberately separate: `priority` is for the
  // one above-the-fold image that should win the browser's fetch queue
  // (fetchpriority=high). `eager` is for images that must actually fetch now
  // (native `loading="lazy"` doesn't reliably trigger for horizontally
  // off-screen siblings in a scroll-snap carousel — see ProductGallery) but
  // should NOT compete at high priority with the real hero image, or they can
  // starve it on a slow connection and leave its box briefly unpainted.
  const loadProps = {
    loading: priority || eager ? 'eager' : 'lazy',
    decoding: 'async',
    // A dead URL (e.g. an admin upload lost to ephemeral storage) shows the
    // quiet cream field instead of the browser's broken-image glyph + alt text.
    onError: (e) => e.currentTarget.closest('.img')?.classList.add('img--failed'),
    ...(priority ? { fetchpriority: 'high' } : {}),
  };

  const wrapCls = ['img', fill ? 'img--fill' : '', className].filter(Boolean).join(' ');
  const wrapStyle = !fill && ratio ? { aspectRatio: ratio } : undefined;
  const imgEl = ['img__el', imgClassName].filter(Boolean).join(' ');

  const m = typeof src === 'string' ? src.match(OPT_RE) : null;

  if (!m) {
    return (
      <span className={wrapCls} style={wrapStyle}>
        <img className={imgEl} src={src || ''} alt={alt} {...loadProps} {...rest} />
      </span>
    );
  }

  const base = `/media/${m[1]}`;
  const set = (ext) => WIDTHS.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ');

  return (
    <span className={wrapCls} style={wrapStyle}>
      <picture>
        <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
        <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
        <img className={imgEl} src={`${base}.jpg`} sizes={sizes} alt={alt} {...loadProps} {...rest} />
      </picture>
    </span>
  );
}
