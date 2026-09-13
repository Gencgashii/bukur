import { useEffect } from 'react';

const BASE_TITLE = 'BUKUR WORLD';
const DEFAULT_DESC =
  'BUKUR WORLD — sculptural heels, designed in Prishtina. Slingbacks, pumps, sandals and statement heels.';
// The canonical production origin. The app is also reachable at other hosts
// (preview deploys, www) — canonical always points at the primary domain.
const SITE_ORIGIN = 'https://bukurworldshop.com';

const upsertMeta = (selector, attr, key, content) => {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

/**
 * Per-route SEO: document.title, meta description, canonical, and the OG/Twitter
 * tags that must change per page. No framework, no helmet dependency.
 *
 * Canonical/og:url are derived from the current path (query strings are dropped
 * so filtered collection views don't fragment into many canonicals).
 */
export default function usePageMeta(title, description) {
  useEffect(() => {
    const fullTitle = title
      ? `${title} — ${BASE_TITLE}`
      : `${BASE_TITLE} — Luxury Heels, Designed in Prishtina`;
    document.title = fullTitle;

    const desc = description || DEFAULT_DESC;
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    const canonical = `${SITE_ORIGIN}${path === '/' ? '/' : path.replace(/\/$/, '')}`;

    upsertMeta('meta[name="description"]', 'name', 'description', desc);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', desc);

    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical);
  }, [title, description]);
}

/**
 * Injects a single JSON-LD <script> into <head> for the lifetime of the calling
 * component. Pass `null` to inject nothing. Used by the PDP for Product schema.
 */
export function useJsonLd(data) {
  useEffect(() => {
    if (!data) return undefined;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-page-jsonld', '');
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [data]);
}

export { SITE_ORIGIN };
