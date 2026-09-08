/**
 * BUKUR WORLD — FAQ content.
 *
 * Plain frontend content, grouped by topic. Each group is { title, items }
 * where items is [{ q, a }]. Answers are kept consistent with what the rest of
 * the site states (checkout, product accordions, footer).
 */

export const faqGroups = [
  {
    title: 'Orders',
    items: [
      {
        q: 'How do I place an order?',
        a: 'Choose your style and size on the product page, add it to your bag, and continue to checkout. You will receive an order confirmation by email once the order is placed.',
      },
      {
        q: 'Can I change or cancel my order?',
        a: 'If your order has not yet been dispatched, write to info@bukur.co with your order reference and we will do our best to amend or cancel it. Once an order has shipped it can no longer be changed.',
      },
      {
        q: 'I did not receive an order confirmation.',
        a: 'Confirmations are sent immediately after checkout. Please check your spam folder first; if nothing arrives within a few minutes, contact info@bukur.co and we will resend it.',
      },
    ],
  },
  {
    title: 'Shipping & delivery',
    items: [
      {
        q: 'Where does BUKUR ship?',
        a: 'We ship across Kosovo and the surrounding region. Delivery is complimentary.',
      },
      {
        q: 'How long does delivery take?',
        a: 'Orders are prepared and dispatched within 1–3 business days. A courier then delivers within the standard timeframe for your address.',
      },
      {
        q: 'Can I collect my order in person?',
        a: 'Yes. Select “Collect in studio” at checkout to pick up your order in Prishtina. We will let you know when it is ready.',
      },
      {
        q: 'How do I track my order?',
        a: 'Once your order is dispatched we will contact you with delivery details. For any question about a shipment in progress, write to info@bukur.co with your order reference.',
      },
    ],
  },
  {
    title: 'Returns & exchanges',
    items: [
      {
        q: 'What is your return policy?',
        a: 'Returns are accepted within 14 days of delivery, provided the shoes are unworn and in their original condition and packaging.',
      },
      {
        q: 'How do I start a return or exchange?',
        a: 'Email info@bukur.co with your order reference and whether you would like a refund or a different size. We will confirm the next steps.',
      },
      {
        q: 'When will I be refunded?',
        a: 'Once your return is received and checked, the refund is issued to your original payment method. Bank processing times vary by provider.',
      },
      {
        q: 'Are sale items returnable?',
        a: 'Yes, the standard 14-day policy applies unless a specific item is marked final sale on its product page.',
      },
    ],
  },
  {
    title: 'Payment',
    items: [
      {
        q: 'Which payment methods do you accept?',
        a: 'Bank transfer and cash on delivery. Secure online card payment is coming soon.',
      },
      {
        q: 'How does bank transfer work?',
        a: 'Place your order and choose bank transfer. The account details and a payment reference are shown on the confirmation screen and sent by email. Your order ships once we confirm the transfer.',
      },
      {
        q: 'Is my payment information secure?',
        a: 'We never see or store card details. Bank transfers are made directly to our account, and cash on delivery is settled with the courier on arrival.',
      },
      {
        q: 'In which currency are prices shown?',
        a: 'All prices are in euros (€). The total confirmed at checkout is the amount you pay.',
      },
    ],
  },
  {
    title: 'Product & sizing',
    items: [
      {
        q: 'How do BUKUR heels fit?',
        a: 'Our heels run true to size. If you are between sizes, we recommend taking the smaller size. The ankle strap is adjustable.',
      },
      {
        q: 'Where are BUKUR shoes made?',
        a: 'Every silhouette is designed in Prishtina and made in small runs, with attention to proportion and finish.',
      },
      {
        q: 'A style I want is sold out. Will it come back?',
        a: 'Signature styles are often restocked. Write to info@bukur.co and we will tell you if and when your size is expected.',
      },
    ],
  },
  {
    title: 'Care',
    items: [
      {
        q: 'How should I care for my heels?',
        a: 'Store them in the dust bag and box, away from direct heat and sunlight. Wipe gently with a soft dry cloth. Let them rest between wears.',
      },
      {
        q: 'Can heel tips and soles be repaired?',
        a: 'Yes. Heel tips are consumable and can be replaced by a good cobbler. For anything else, contact info@bukur.co.',
      },
    ],
  },
];

export const faqContact = {
  eyebrow: 'Still need help?',
  title: 'Talk to client care.',
  body: 'If your question is not answered here, our team in Prishtina is glad to help.',
  email: 'info@bukur.co',
};

export default faqGroups;
