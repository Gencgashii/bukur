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
  fill = false,
  ratio,
  className = '',
  imgClassName = '',
  ...rest
}) {
  const loadProps = {
    alt,
    loading: priority ? 'eager' : 'lazy',
    decoding: 'async',
    ...(priority ? { fetchpriority: 'high' } : {}),
  };

  const wrapCls = ['img', fill ? 'img--fill' : '', className].filter(Boolean).join(' ');
  const wrapStyle = !fill && ratio ? { aspectRatio: ratio } : undefined;
  const imgEl = ['img__el', imgClassName].filter(Boolean).join(' ');

  const m = typeof src === 'string' ? src.match(OPT_RE) : null;

  if (!m) {
    return (
      <span className={wrapCls} style={wrapStyle}>
        <img className={imgEl} src={src || ''} {...loadProps} {...rest} />
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
        <img className={imgEl} src={`${base}.jpg`} sizes={sizes} {...loadProps} {...rest} />
      </picture>
    </span>
  );
}
