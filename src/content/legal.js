/**
 * BUKUR WORLD — legal documents.
 *
 * Each document is { title, updated, intro, sections: [{ heading, body: string[] }] }.
 * Rendered by src/pages/LegalPage.js. Add `privacy` / `cookies` here later using
 * the same shape and they will render with no further code.
 *
 * NOTE: this is a plain-language starting point consistent with how the store
 * operates. Have it reviewed by legal counsel before relying on it.
 */

const company = 'BUKUR Group LLC';
const place = 'Prishtina, Kosovo';
const email = 'info@bukur.co';

export const terms = {
  title: 'Terms & Conditions',
  updated: '8 September 2026',
  intro:
    `These Terms & Conditions govern your use of bukurworld.com (the “Site”) and any purchase you make from BUKUR. The Site is operated by ${company}, ${place}. By browsing the Site or placing an order you accept these terms. If you do not agree with them, please do not use the Site.`,
  sections: [
    {
      heading: '1. Who we are',
      body: [
        `BUKUR is a luxury footwear house operated by ${company}, based in ${place}. You can reach our client care team at ${email}.`,
      ],
    },
    {
      heading: '2. Eligibility',
      body: [
        'You must be at least 18 years old and able to enter into a binding contract to place an order. By ordering, you confirm that the information you provide is accurate and that the payment method used is your own or that you are authorised to use it.',
      ],
    },
    {
      heading: '3. Products',
      body: [
        'We take care to present each style accurately. Colours, textures and finishes may nonetheless appear differently depending on your screen, and small variations are inherent to hand-finished footwear and are not defects.',
        'All items are subject to availability. We may change or discontinue a style at any time.',
      ],
    },
    {
      heading: '4. Prices',
      body: [
        'Prices are shown in euros (€) and include applicable taxes unless stated otherwise. Shipping costs, where they apply, are shown before you confirm your order.',
        'We may change prices at any time, but changes will not affect orders we have already confirmed. If a price is clearly incorrect due to an error, we may cancel the order and refund any amount paid.',
      ],
    },
    {
      heading: '5. Orders',
      body: [
        'Your order is an offer to buy. A contract is formed only when we send you a dispatch confirmation for the relevant item. Until then we may decline or cancel an order — for example if an item is out of stock, if we cannot verify payment, or if we suspect fraud or misuse.',
        'You will receive an order confirmation by email once an order is placed. Please check it and contact us promptly if anything is wrong.',
      ],
    },
    {
      heading: '6. Payment',
      body: [
        'We accept bank transfer and cash on delivery. Secure online card payment is being added.',
        'For bank transfer, the account details and a payment reference are shown after checkout and sent by email; your order is prepared for dispatch once we confirm the transfer. For cash on delivery, the total is paid to the courier on arrival.',
        'We do not receive or store card details.',
      ],
    },
    {
      heading: '7. Shipping & delivery',
      body: [
        'We ship across Kosovo and the surrounding region. Delivery is complimentary unless stated otherwise at checkout.',
        'Orders are dispatched within 1–3 business days. Delivery times given are estimates and are not guaranteed. Risk of loss or damage passes to you on delivery; title passes once we have received payment in full.',
      ],
    },
    {
      heading: '8. Returns, exchanges & refunds',
      body: [
        'You may return eligible items within 14 days of delivery, provided they are unworn and in their original condition and packaging. Items marked final sale on their product page cannot be returned.',
        `To start a return or exchange, email ${email} with your order reference. Once we receive and check the return, refunds are issued to your original payment method; bank processing times vary.`,
        'This does not affect any statutory rights you may have as a consumer.',
      ],
    },
    {
      heading: '9. Cancellation',
      body: [
        `You may ask to change or cancel an order before it is dispatched by emailing ${email} with your order reference. Once an order has been dispatched it can no longer be changed and the returns process applies.`,
      ],
    },
    {
      heading: '10. Intellectual property',
      body: [
        'The BUKUR name, logo, product designs, photography, text and all other content on the Site are owned by BUKUR or its licensors and are protected by intellectual-property laws. You may not copy, reproduce, distribute or create derivative works from any part of the Site without our prior written permission.',
      ],
    },
    {
      heading: '11. Acceptable use',
      body: [
        'You agree to use the Site lawfully and not to interfere with its operation, attempt to gain unauthorised access, introduce malicious code, or use it to infringe the rights of others.',
      ],
    },
    {
      heading: '12. Liability',
      body: [
        'The Site is provided on an “as is” basis. To the extent permitted by law, BUKUR is not liable for indirect or consequential loss, or for loss arising from circumstances outside our reasonable control. Nothing in these terms limits liability that cannot be limited by law, including for death or personal injury caused by negligence or for fraud.',
      ],
    },
    {
      heading: '13. Privacy',
      body: [
        'We handle personal data in line with our Privacy Policy. Please review it to understand what we collect and how it is used.',
      ],
    },
    {
      heading: '14. Force majeure',
      body: [
        'We are not responsible for delay or failure to perform caused by events beyond our reasonable control, including supply disruption, carrier delays, strikes, or acts of government.',
      ],
    },
    {
      heading: '15. Governing law',
      body: [
        'These terms are governed by the laws of the Republic of Kosovo, and the courts of Kosovo have jurisdiction over any dispute, without prejudice to mandatory consumer-protection rights in your country of residence.',
      ],
    },
    {
      heading: '16. Changes to these terms',
      body: [
        'We may update these terms from time to time. The version in force is the one published on the Site at the time you place your order. Material changes take effect when posted here.',
      ],
    },
    {
      heading: '17. Contact',
      body: [
        `Questions about these terms can be sent to ${email}, or by post to ${company}, ${place}.`,
      ],
    },
  ],
};

export const privacy = {
  title: 'Privacy Policy',
  updated: '8 September 2026',
  intro:
    `This Privacy Policy explains how ${company} (“BUKUR”, “we”), ${place}, collects and uses your personal data when you visit bukurworld.com or place an order, and the rights you have. For any privacy question, contact us at ${email}.`,
  sections: [
    {
      heading: '1. Who is responsible for your data',
      body: [
        `${company}, ${place}, is the controller of the personal data described in this policy. You can reach us at ${email}.`,
      ],
    },
    {
      heading: '2. What we collect',
      body: [
        'Information you give us: your name, email address, phone number, delivery and billing address, order and payment-method details (we do not receive or store card numbers), and the content of messages you send us.',
        'Information collected automatically: device and browser type, IP address, pages viewed and actions taken on the Site, and similar data from cookies and comparable technologies.',
      ],
    },
    {
      heading: '3. How and why we use it',
      body: [
        'To take and fulfil your order, arrange delivery, process payment and provide customer care — this is necessary to perform our contract with you.',
        'To prevent fraud, keep the Site secure, and meet accounting, tax and other legal obligations — on the basis of our legitimate interests and legal obligations.',
        'To send you marketing about BUKUR where you have asked to receive it, and to understand how the Site is used so we can improve it — on the basis of your consent or our legitimate interests, as applicable.',
      ],
    },
    {
      heading: '4. Cookies',
      body: [
        'We use strictly necessary cookies to run the Site and, with your consent where required, analytics and preference cookies. You can control cookies through your browser settings; disabling some may affect how the Site works.',
      ],
    },
    {
      heading: '5. Who we share it with',
      body: [
        'We share personal data only as needed with: delivery and logistics partners; banks and payment providers; IT, hosting and email-service providers who process data on our instructions; professional advisers; and public authorities where the law requires it.',
        'We do not sell your personal data.',
      ],
    },
    {
      heading: '6. International transfers',
      body: [
        'Some of our service providers may process data outside Kosovo or the EEA. Where that happens, we rely on appropriate safeguards such as standard contractual clauses or an adequacy decision.',
      ],
    },
    {
      heading: '7. How long we keep it',
      body: [
        'We keep personal data only as long as needed for the purpose it was collected for. Order and transaction records are retained for the periods required by accounting and tax law; marketing data is kept until you opt out; enquiry correspondence is kept for a reasonable period and then deleted.',
      ],
    },
    {
      heading: '8. Your rights',
      body: [
        'Subject to applicable law, you may request access to your data, correction of inaccurate data, deletion, restriction or objection to certain processing, and portability of data you provided to us. Where processing is based on consent, you can withdraw it at any time without affecting prior processing.',
        `To exercise any of these rights, email ${email}. You also have the right to lodge a complaint with the Information and Privacy Agency of Kosovo or your local supervisory authority.`,
      ],
    },
    {
      heading: '9. Marketing',
      body: [
        'If you have opted in to the BUKUR Letter or other updates, you can unsubscribe at any time using the link in the email or by writing to us. We will still send you service messages related to your orders.',
      ],
    },
    {
      heading: '10. Security',
      body: [
        'We use appropriate technical and organisational measures to protect personal data against loss, misuse and unauthorised access. No method of transmission or storage is completely secure, but we work to keep our safeguards current.',
      ],
    },
    {
      heading: '11. Children',
      body: [
        'The Site is not directed at children under 18 and we do not knowingly collect their personal data. If you believe a child has provided us data, contact us and we will delete it.',
      ],
    },
    {
      heading: '12. Third-party links',
      body: [
        'The Site may link to other websites, including social media. We are not responsible for their privacy practices; please review their policies.',
      ],
    },
    {
      heading: '13. Changes to this policy',
      body: [
        'We may update this policy from time to time. The current version is always the one published here, with the date it took effect shown above.',
      ],
    },
    {
      heading: '14. Contact',
      body: [
        `Questions or requests about your personal data can be sent to ${email}, or by post to ${company}, ${place}.`,
      ],
    },
  ],
};

export const cookies = {
  title: 'Cookies Policy',
  updated: '8 September 2026',
  intro:
    `This Cookies Policy explains the cookies and similar technologies used on bukurworld.com, operated by ${company}, ${place}. It should be read together with our Privacy Policy.`,
  sections: [
    {
      heading: '1. What these technologies are',
      body: [
        'Cookies are small text files placed on your device by a website. “Similar technologies” include browser local storage and session storage, which a site can use to remember information between pages and visits. We refer to all of these together as “cookies” in this policy.',
      ],
    },
    {
      heading: '2. What we currently use',
      body: [
        'BUKUR uses only strictly necessary and functional storage. We do not use advertising cookies, and we do not run third-party analytics or tracking on the Site at this time.',
        'Functional storage on your device remembers: the contents of your shopping bag, your language preference, your shipping region, and whether you have seen the opening screen. These are set by BUKUR, kept on your device, and are not shared with anyone.',
        'A session cookie is used only for signing in to the private admin area. It is not set for normal shoppers.',
      ],
    },
    {
      heading: '3. Third-party cookies',
      body: [
        'We do not currently load third-party cookies (for example from analytics, social media or advertising providers). If we introduce any in the future — such as website analytics or marketing pixels — we will update this policy and, where the law requires it, ask for your consent before they are set.',
      ],
    },
    {
      heading: '4. Managing cookies',
      body: [
        'You can delete or block cookies and clear local storage through your browser settings, and most browsers let you refuse cookies from specific sites. Note that blocking functional storage will stop features such as the shopping bag and saved preferences from working correctly.',
        'Guidance for the common browsers is available in their own help pages under “cookies” or “site data”.',
      ],
    },
    {
      heading: '5. Changes to this policy',
      body: [
        'We may update this policy as the Site evolves. The current version is always the one published here, with the date it took effect shown above.',
      ],
    },
    {
      heading: '6. Contact',
      body: [
        `Questions about this policy can be sent to ${email}.`,
      ],
    },
  ],
};

export const legalDocs = { terms, privacy, cookies };

export default legalDocs;
