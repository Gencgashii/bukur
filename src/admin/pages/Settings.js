import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAsync, Spinner, Msg, Field, money } from '../components/ui';

export default function Settings() {
  const { loading, error, data, reload } = useAsync(() => api.settings(), []);
  const [bank, setBank] = useState({ holder: '', iban: '', bank: '', swift: '', instructions: '' });
  const [contact, setContact] = useState({ email: '', phone: '', address: '' });
  const [threshold, setThreshold] = useState('3');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!data) return;
    const s = data.settings || {};
    setBank({ holder: '', iban: '', bank: '', swift: '', instructions: '', ...(s.bank_transfer || {}) });
    setContact({ email: '', phone: '', address: '', ...(s.contact || {}) });
    setThreshold(String(s.low_stock_threshold_default ?? 3));
  }, [data]);

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await api.saveSettings({
        bank_transfer: bank,
        contact,
        low_stock_threshold_default: Math.max(0, Math.trunc(Number(threshold) || 0)),
      });
      setMsg('Settings saved.');
      reload();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  if (loading) return <Spinner />;
  if (error) return <Msg kind="error">{error}</Msg>;
  const shipping = data.shippingConfig || {};

  return (
    <div className="ad-page">
      <h1 className="ad-h1">Store Settings</h1>
      <Msg kind="success">{msg}</Msg>
      <Msg kind="error">{err}</Msg>

      <form className="ad-card" onSubmit={save}>
        <h2 className="ad-h2">Bank transfer instructions</h2>
        <div className="ad-grid ad-grid--2">
          <Field label="Account holder"><input value={bank.holder} onChange={(e) => setBank({ ...bank, holder: e.target.value })} /></Field>
          <Field label="IBAN"><input value={bank.iban} onChange={(e) => setBank({ ...bank, iban: e.target.value })} /></Field>
          <Field label="Bank name"><input value={bank.bank} onChange={(e) => setBank({ ...bank, bank: e.target.value })} /></Field>
          <Field label="SWIFT / BIC"><input value={bank.swift} onChange={(e) => setBank({ ...bank, swift: e.target.value })} /></Field>
        </div>
        <Field label="Instructions shown at checkout"><textarea rows={3} value={bank.instructions} onChange={(e) => setBank({ ...bank, instructions: e.target.value })} /></Field>

        <h2 className="ad-h2">Store contact</h2>
        <div className="ad-grid ad-grid--2">
          <Field label="Email"><input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></Field>
          <Field label="Phone"><input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></Field>
        </div>
        <Field label="Address"><input value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} /></Field>

        <h2 className="ad-h2">Inventory</h2>
        <Field label="Default low-stock threshold for new products"><input type="number" min="0" step="1" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></Field>

        <div className="ad-form-actions">
          <button className="ad-btn ad-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
        </div>
      </form>

      <div className="ad-card">
        <h2 className="ad-h2">Shipping &amp; tax (read-only)</h2>
        <p className="ad-muted">{shipping.note}</p>
        <dl className="ad-dl">
          <dt>Currency</dt><dd>{String(shipping.currency || '').toUpperCase()}</dd>
          <dt>Supported countries</dt><dd>{(shipping.supportedCountries || []).join(', ') || '—'}</dd>
          <dt>Shipping rates</dt><dd>{Object.entries(shipping.shippingRatesCents || {}).map(([k, v]) => `${k}: ${money(v, shipping.currency)}`).join(' · ') || '—'}</dd>
          <dt>Tax rate</dt><dd>{((shipping.taxRateBps || 0) / 100).toFixed(2)}%</dd>
          <dt>Cash on delivery</dt><dd>{shipping.codEnabled ? 'Enabled' : 'Disabled'}</dd>
        </dl>
      </div>
    </div>
  );
}
