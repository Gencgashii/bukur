import { shippingEstimateCents, SHIPPING_COUNTRIES } from './config';

// Pure-function coverage for the checkout shipping estimate — mirrors the
// server rule in server/lib/pricing.js: studio pickup has no delivery cost,
// independent of country; home delivery uses the flat per-country rate.

test('shippingEstimateCents: home delivery (default) uses the country rate', () => {
  const kosovo = SHIPPING_COUNTRIES.find((c) => c.code === 'XK');
  const albania = SHIPPING_COUNTRIES.find((c) => c.code === 'AL');
  expect(shippingEstimateCents('XK')).toBe(kosovo.estimateCents);
  expect(shippingEstimateCents('AL', 'standard')).toBe(albania.estimateCents);
});

test('shippingEstimateCents: pickup is always 0, regardless of country', () => {
  expect(shippingEstimateCents('XK', 'pickup')).toBe(0);
  expect(shippingEstimateCents('GB', 'pickup')).toBe(0);
  expect(shippingEstimateCents('UNKNOWN', 'pickup')).toBe(0);
});

test('shippingEstimateCents: switching delivery method changes only the estimate, not the country rate table', () => {
  const country = 'AL';
  const homeEstimate = shippingEstimateCents(country, 'standard');
  const pickupEstimate = shippingEstimateCents(country, 'pickup');
  expect(homeEstimate).toBeGreaterThan(0);
  expect(pickupEstimate).toBe(0);
  // switching back returns the exact same home-delivery figure — no drift
  expect(shippingEstimateCents(country, 'standard')).toBe(homeEstimate);
});
