import React, { useState } from 'react';
import usePageMeta from '../hooks/usePageMeta';
import Reveal from '../components/Reveal';
import contactInfo from '../content/contact';
import './Contact.css';

const Contact = () => {
  usePageMeta('Contact', 'Contact BUKUR WORLD — client care for orders, sizing, returns and press.');

  const [form, setForm] = useState({ name: '', email: '', order: '', message: '' });
  const [sent, setSent] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = (e) => {
    e.preventDefault();
    const subject = form.order
      ? `Client care — order ${form.order}`
      : 'Client care enquiry';
    const body = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      form.order ? `Order reference: ${form.order}` : null,
      '',
      form.message,
    ]
      .filter((line) => line !== null)
      .join('\n');
    window.location.href = `mailto:${contactInfo.formTo}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  return (
    <div className="contact">
      <div className="container">
        <div className="contact__grid">
          <div className="contact__intro">
            <Reveal className="reveal--soft">
              <p className="u-eyebrow">{contactInfo.eyebrow}</p>
              <h1 className="u-display u-display--light">{contactInfo.title}</h1>
              <p className="u-lede">{contactInfo.intro}</p>
            </Reveal>

            <div className="contact__channels">
              {contactInfo.channels.map((c) => (
                <div className="contact__channel" key={c.label}>
                  <span className="u-fine">{c.label}</span>
                  {c.href ? (
                    <a href={c.href} className="contact__value link-underline">{c.value}</a>
                  ) : (
                    <span className="contact__value">{c.value}</span>
                  )}
                  {c.note && <p className="contact__note">{c.note}</p>}
                </div>
              ))}

              <div className="contact__channel">
                <span className="u-fine">Social</span>
                <p className="contact__social">
                  {contactInfo.social.map((s, i) => (
                    <React.Fragment key={s.label}>
                      {i > 0 && <span aria-hidden="true"> · </span>}
                      <a href={s.href} target="_blank" rel="noopener noreferrer" className="link-underline">
                        {s.label}
                      </a>
                    </React.Fragment>
                  ))}
                </p>
              </div>
            </div>
          </div>

          <div className="contact__form-wrap">
            {sent ? (
              <div className="contact__sent" role="status">
                <p className="u-eyebrow">Thank you</p>
                <h2 className="u-title">Your message is ready to send</h2>
                <p className="u-lede">
                  We have opened your email app with the message prefilled. If nothing opened, write to{' '}
                  <a href={`mailto:${contactInfo.formTo}`} className="link-underline">{contactInfo.formTo}</a>.
                </p>
              </div>
            ) : (
              <form className="contact__form" onSubmit={onSubmit}>
                <label className="contact__field">First and last name*
                  <input type="text" name="name" value={form.name} onChange={onChange} required />
                </label>
                <label className="contact__field">Email*
                  <input type="email" name="email" value={form.email} onChange={onChange} required />
                </label>
                <label className="contact__field">Order reference (optional)
                  <input type="text" name="order" value={form.order} onChange={onChange} placeholder="BK-000000" />
                </label>
                <label className="contact__field">How can we help?*
                  <textarea name="message" rows={6} value={form.message} onChange={onChange} required />
                </label>
                <button type="submit" className="btn btn--block">Send message</button>
                <p className="contact__disclaimer">
                  This opens your email app addressed to {contactInfo.formTo}.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
