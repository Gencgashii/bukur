/**
 * BUKUR WORLD — the house story (About page).
 *
 * Editorial / brand content, written in the house's collective voice and kept
 * consistent with the rest of the site (home, product copy, FAQ). Photography
 * resolves through <Img> from the optimised /media pipeline. No founder
 * biography is invented here — the story is told as "the house".
 */

export const aboutContent = {
  hero: {
    image: '/media/campaign-spotlight.jpg',
    alt: 'BUKUR WORLD — the collection under a single beam of light',
    eyebrow: 'The House · Est. Prishtina 2026',
    title: 'BUKUR WORLD',
    lede: 'A luxury footwear house building one thing with total attention: the heel you remember.',
  },

  manifesto: [
    'BUKUR is a modern luxury footwear house from Prishtina. We approach a heel the way a sculptor approaches a form — proportion first, then the single detail you only notice on the second look.',
    'Nothing is decorative for its own sake. A confident heel, a precise toe, an ankle strap that actually holds. The shoe should disappear on the foot and stay in the room.',
  ],

  origin: {
    eyebrow: 'The Place',
    title: 'Drawn in Prishtina.',
    body:
      'Every silhouette begins here, in Kosovo — sketched, cut in paper, refined on the last until the line is right. Prishtina is young, direct and unimpressed by noise. So is the work.',
    media: { src: '/media/monogram-mesh-hero.jpg', alt: 'BUKUR Monogram Mesh Slingback' },
  },

  quote: 'A heel should be looked at twice.',

  signature: {
    eyebrow: 'The Signature',
    title: 'The openwork heel.',
    body:
      'The sculpted, cut-away BUKUR heel is the house’s handwriting — an object in its own right, carrying satin, tulle and hand-folded detail without ever competing with them. Materials are chosen for how they age, not how they photograph.',
    media: { src: '/media/veil-mesh-trio.jpg', alt: 'BUKUR Veil Mesh Pump in rouge, ivory and black' },
  },

  craft: {
    eyebrow: 'The Making',
    title: 'Made in small runs.',
    body:
      'Each style is produced in limited quantity and finished by hand — the bow folded, the vamp set, the edge burnished. Small runs mean we can be exact, and it means the pair you receive was actually looked at.',
    media: { src: '/media/bow-slingback-trio.jpg', alt: 'BUKUR Signature Bow Slingback in blush, black and periwinkle' },
  },

  values: [
    { label: 'Proportion first', text: 'The line of the shoe is decided before anything is added to it.' },
    { label: 'Restraint', text: 'One idea per shoe. Nothing on it that does not need to be there.' },
    { label: 'Made for the entrance', text: 'Built to be worn into a room, not photographed and put away.' },
  ],

  closing: {
    eyebrow: 'The Invitation',
    title: 'Made for the entrance.',
    cta: { to: '/products', label: 'Discover the collection' },
  },
};

export default aboutContent;
