// REACT_APP_API_URL is baked in at build time (see scripts/check-frontend-env.js,
// which fails a hosted build when it is missing). The localhost fallback is for
// local `npm start` only and is compiled out of a production build.
export const API_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:9000');

// Real values come from REACT_APP_BANK_* at build time (set in Vercel). No
// placeholder fallbacks — if they are unset, checkout tells the customer the
// details will be emailed instead of showing a fake IBAN.
export const BANK_DETAILS = {
  holder: process.env.REACT_APP_BANK_HOLDER || '',
  iban: process.env.REACT_APP_BANK_IBAN || '',
  bank: process.env.REACT_APP_BANK_NAME || '',
  swift: process.env.REACT_APP_BANK_SWIFT || '',
};

// Payment method identifiers. MUST match the backend (server/config.js).
export const PAYMENT_METHODS = {
  CARD_TEB: 'card_teb',
  BANK_TRANSFER: 'bank_transfer',
  CASH_ON_DELIVERY: 'cash_on_delivery',
};

// Supported shipping destinations (structured — no free-text country matching).
// These are for the pre-submit ESTIMATE only. The backend returns the
// authoritative total on the order response — it MUST list the same
// countries at the same rates via its SHIPPING_RATES env var, or an order to
// a country added here only will be rejected at submit. Sorted alphabetically
// by label (shown in the checkout Country dropdown in this order).
// USA and Canada are intentionally not listed yet — no shipping rate has
// been set for them.
export const SHIPPING_COUNTRIES = [
  { code: 'AL', label: 'Albania', estimateCents: 480 },
  { code: 'AT', label: 'Austria', estimateCents: 2000 },
  { code: 'BE', label: 'Belgium', estimateCents: 2000 },
  { code: 'BG', label: 'Bulgaria', estimateCents: 2000 },
  { code: 'HR', label: 'Croatia', estimateCents: 2000 },
  { code: 'FR', label: 'France', estimateCents: 2000 },
  { code: 'DE', label: 'Germany', estimateCents: 2000 },
  { code: 'GR', label: 'Greece', estimateCents: 2000 },
  { code: 'IT', label: 'Italy', estimateCents: 2000 },
  { code: 'XK', label: 'Kosovo', estimateCents: 200 },
  { code: 'MK', label: 'North Macedonia', estimateCents: 480 },
  { code: 'SI', label: 'Slovenia', estimateCents: 2000 },
  { code: 'SE', label: 'Sweden', estimateCents: 2000 },
  { code: 'CH', label: 'Switzerland', estimateCents: 2000 },
  { code: 'GB', label: 'United Kingdom', estimateCents: 2000 },
];

export const shippingEstimateCents = (countryCode) =>
  SHIPPING_COUNTRIES.find((c) => c.code === countryCode)?.estimateCents ?? 0;
