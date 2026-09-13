/**
 * BUKUR WORLD — analytics seam.
 *
 * A single `track(event, params)` entry point. By default it pushes a
 * GTM/GA4-style object onto `window.dataLayer`, which is harmless when no tag
 * manager is installed. To activate real analytics, add ONE of:
 *   - Google Tag Manager / GA4 snippet in public/index.html, or
 *   - Plausible / Fathom / Vercel Analytics script
 * and (for GA4) map these events to conversions. No provider is bundled here,
 * so there is nothing to configure in the repo — see docs/PRODUCTION-CHECKLIST.
 *
 * Events used by the storefront (standard GA4 e-commerce names):
 *   view_product · add_to_cart · begin_checkout · purchase
 *
 * Privacy: only non-identifying commerce data is passed (ids, names, prices,
 * sizes, quantities, currency). Never call track() with an email, phone,
 * address, or payment detail.
 */

const CURRENCY = 'EUR';

export function track(event, params = {}) {
  if (typeof window === 'undefined') return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, currency: CURRENCY, ...params });
    // Also forward to gtag if a GA4 tag is present (no-op otherwise).
    if (typeof window.gtag === 'function') {
      window.gtag('event', event, { currency: CURRENCY, ...params });
    }
  } catch {
    /* analytics must never break the app */
  }
}

const analytics = { track };
export default analytics;
