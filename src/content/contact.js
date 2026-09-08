/**
 * BUKUR WORLD — contact details.
 * Real details, sourced from the house's own channels (bukur.co, @bukurworld).
 */

export const contactInfo = {
  eyebrow: 'Client care',
  title: 'Contact BUKUR',
  intro:
    'For orders, sizing, returns or anything else, our team in Prishtina is here to help. We reply within 1–2 business days.',

  channels: [
    {
      label: 'Client care',
      value: 'info@bukur.co',
      href: 'mailto:info@bukur.co',
      note: 'Orders, shipping, returns and product questions.',
    },
    {
      label: 'Studio',
      value: 'Prishtina, Kosovo',
      note: 'BUKUR Group LLC. Visits by appointment.',
    },
  ],

  social: [
    { label: 'Instagram', value: '@bukurworld', href: 'https://www.instagram.com/bukurworld/' },
    { label: 'TikTok', value: '@bukur.world', href: 'https://www.tiktok.com/@bukur.world' },
    { label: 'Facebook', value: 'bukurworld', href: 'https://www.facebook.com/bukurworld/' },
  ],

  // Where the contact form composes its message.
  formTo: 'info@bukur.co',
};

export default contactInfo;
