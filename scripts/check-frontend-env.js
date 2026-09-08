'use strict';
/**
 * Pre-build guard for the React storefront.
 *
 * Runs automatically before `npm run build` (npm "prebuild" hook). When the
 * build is clearly a hosted production build (Vercel / Render / an explicit
 * opt-in) it FAILS the build if REACT_APP_API_URL is missing or points at
 * localhost — so a misconfigured deploy can never ship a bundle that calls
 * http://localhost:9000. In a plain local `npm run build` it only warns.
 *
 * REACT_APP_API_URL is PUBLIC (baked into the client bundle). It is set at
 * BUILD time in the static host's dashboard, never on the API.
 */

const api = String(process.env.REACT_APP_API_URL || '').trim();

// Signals that this is a hosted production build, not a dev machine.
const hostedBuild =
  !!process.env.VERCEL ||
  !!process.env.RENDER ||
  process.env.REACT_APP_REQUIRE_API_URL === 'true';

function bad(reason) {
  const msg = `[frontend-env] REACT_APP_API_URL ${reason}`;
  if (hostedBuild) {
    console.error(`\n${msg}\n[frontend-env] Set it to the HTTPS API origin (e.g. https://bukur-api.onrender.com) in the host's build environment.\n`);
    process.exit(1);
  }
  console.warn(`${msg} — continuing (local build). Set REACT_APP_API_URL for a real deploy.`);
}

if (!api) {
  bad('is not set');
} else {
  let u;
  try {
    u = new URL(api);
  } catch {
    bad('is not a valid URL');
    u = null;
  }
  if (u) {
    const loopback = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
    if (loopback) bad('points at localhost');
    else if (u.protocol !== 'https:' && hostedBuild) bad('is not https://');
    else console.log(`[frontend-env] REACT_APP_API_URL OK (${u.origin})`);
  }
}
