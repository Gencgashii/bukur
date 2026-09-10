/**
 * BUKUR WORLD — homepage editorial composition.
 *
 * This is EDITORIAL / BRAND media, deliberately kept separate from the product
 * catalogue. The homepage renders from this manifest, so it stays visually
 * stable when products are added, edited, archived, or restocked.
 *
 * Images resolve through <Img>, which upgrades any `/media/<slug>.jpg` to the
 * responsive AVIF/WebP/JPEG set produced by `npm run media:optimize`. Swap in
 * higher-resolution source files under the same names in media-src/ and re-run
 * the pipeline — nothing here needs to change.
 *
 * A future admin CMS would populate this same shape from `GET /store/content/home`
 * (see the audit's "backend work" note). For now it is a single edit point.
 */

export const homeContent = {
  hero: {
    image: '/media/campaign-spotlight.jpg',
    alt: 'BUKUR WORLD — the new collection under a single beam of light',
    eyebrow: 'BUKUR WORLD',
    title: 'The art of the entrance.',
    cta: { to: '/products', label: 'Discover the collection' },
    // dark, cinematic frame with open space upper-left — copy sits lower-left
  },

  // one quiet line, a lot of air
  brandStatement:
    'A luxury footwear house from Prishtina. Heels drawn with a sculptor’s instinct — proportion first, then the detail you notice on the second look.',

  editorials: [
    {
      id: 'signature',
      eyebrow: 'The Signature',
      title: 'The bow, reimagined.',
      body:
        'A pointed satin slingback finished with a hand-folded bow and the BUKUR monogram. Floral-embroidered, quietly precise — the house’s defining silhouette.',
      cta: { to: '/products?category=Slingbacks', label: 'Explore slingbacks' },
      media: { src: '/media/bow-slingback-trio.jpg', alt: 'BUKUR Signature Bow Slingback in blush, black and periwinkle' },
      wide: true,
    },
    {
      id: 'statement',
      eyebrow: 'Statement',
      title: 'Sculpture for the foot.',
      body:
        'Draped tulle set on the openwork BUKUR heel. An evening shoe built like an object — meant to be looked at twice.',
      cta: { to: '/products?category=Statement', label: 'See the statement edit' },
      media: { src: '/media/veil-mesh-trio.jpg', alt: 'BUKUR Veil Mesh Pump in rouge, ivory and black' },
      flip: true,
      dark: true,
      wide: true,
    },
  ],

  // full-bleed daylight beat between the darker editorials
  editorialFull: {
    image: '/media/lookbook-daylight.jpg',
    alt: 'BUKUR heels arranged on ivory plinths in daylight',
    eyebrow: 'The Lookbook',
    title: 'Made to move through the world.',
    align: 'left',
  },

  // Mood edits, not silhouette types. Each name must match a category created
  // in the admin (Categories) and assigned to products for the tile link to
  // filter the collection. Images live at /media/<slug>.jpg.
  categories: [
    { name: 'Posh', image: '/media/posh.jpg' },
    { name: 'All eyes on me', image: '/media/all-eyes-on-me.jpg' },
    { name: 'Runway', image: '/media/runway.jpg' },
    { name: 'Old money', image: '/media/old-money.jpg' },
  ],

  campaign: {
    image: '/media/monogram-mesh-hero.jpg',
    alt: 'BUKUR Monogram Mesh Slingback',
    eyebrow: 'The Collection',
    title: 'Enter BUKUR WORLD',
    cta: { to: '/products', label: 'Shop all heels' },
  },

  house: {
    eyebrow: 'Est. Prishtina',
    title: 'Designed in Prishtina. Made to be remembered.',
    body:
      'BUKUR is a modern luxury footwear house from Kosovo. Every silhouette is drawn with a sculptural instinct — considered proportions, a confident heel, and details you notice on the second look.',
    cta: { to: '/about', label: 'Read the house story' },
  },
};

export default homeContent;
