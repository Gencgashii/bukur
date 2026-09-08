// REACT_APP_API_URL is baked in at build time (see scripts/check-frontend-env.js,
// which fails a hosted build when it is missing). The localhost fallback is for
// local `npm start` only and is compiled out of a production build.
export const API_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:9000');

export const BANK_DETAILS = {
  holder: process.env.REACT_APP_BANK_HOLDER || 'BUKUR',
  iban: process.env.REACT_APP_BANK_IBAN || 'XK00 0000 0000 0000 0000',
  bank: process.env.REACT_APP_BANK_NAME || 'Raiffeisen Bank',
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
// authoritative total on the order response.
export const SHIPPING_COUNTRIES = [
  { code: 'XK', label: 'Kosovo', estimateCents: 180 },
  { code: 'AL', label: 'Albania', estimateCents: 480 },
];

export const shippingEstimateCents = (countryCode) =>
  SHIPPING_COUNTRIES.find((c) => c.code === countryCode)?.estimateCents ?? 0;
