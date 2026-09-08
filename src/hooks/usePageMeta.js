import { useEffect } from 'react';

const BASE_TITLE = 'BUKUR WORLD';
const DEFAULT_DESC = 'BUKUR WORLD — sculptural heels, designed in Prishtina. Slingbacks, pumps, sandals and statement heels.';

/**
 * Lightweight per-route SEO: sets document.title and the meta description.
 * No framework, no helmet dependency.
 */
export default function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE_TITLE}` : `${BASE_TITLE} — Luxury Heels, Designed in Prishtina`;

    const desc = description || DEFAULT_DESC;
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'description');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', desc);

    let og = document.querySelector('meta[property="og:title"]');
    if (og) og.setAttribute('content', title ? `${title} — ${BASE_TITLE}` : BASE_TITLE);
  }, [title, description]);
}
