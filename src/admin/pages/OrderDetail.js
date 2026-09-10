import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync, Spinner, Msg, Table, Pill, ConfirmButton, money, dt } from '../components/ui';

const NEXT_FULFILLMENT = {
  pending: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

const METHOD_LABELS = {
  bank_transfer: 'Bank transfer',
  cash_on_delivery: 'Cash on delivery',
  card_teb: 'Card (online)',
};

export default function OrderDetail() {
  const { id } = useParams();
  const { loading, error, data, reload } = useAsync(() => api.order(id), [id]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [methodDraft, setMethodDraft] = useState(null);

  if (loading) return <Spinner label="Loading order…" />;
  if (error) return <Msg kind="error">{error}</Msg>;
  const o = data.order;
  const addr = o.shippingAddress || {};
  const isOffline = o.paymentMethod === 'bank_transfer' || o.paymentMethod === 'cash_on_delivery';
  const settled = o.paymentStatus === 'paid' || o.paymentStatus === 'refunded';
  const chosenMethod = methodDraft ?? o.paymentMethod;

  const setFulfillment = async (to) => {
    setBusy(true); setErr(''); setMsg('');
    try { await api.updateOrder(id, { fulfillmentStatus: to }); setMsg(`Fulfillment → ${to}.`); reload(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const confirmPayment = async () => {
    setBusy(true); setErr(''); setMsg('');
    try { await api.updateOrder(id, { paymentStatus: 'paid' }); setMsg('Payment marked paid.'); reload(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const changeMethod = async () => {
    if (chosenMethod === o.paymentMethod) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await api.updateOrder(id, { paymentMethod: chosenMethod });
      setMsg(`Payment method → ${METHOD_LABELS[chosenMethod] || chosenMethod}.`);
      setMethodDraft(null);
      reload();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="ad-page">
      <div className="ad-page__head">
        <h1 className="ad-h1">Order {o.number}</h1>
        <Link className="ad-btn ad-btn--ghost" to="/admin/orders">← All orders</Link>
      </div>
      <Msg kind="success">{msg}</Msg>
      <Msg kind="error">{err}</Msg>

      <div className="ad-grid ad-grid--2">
        <div className="ad-card">
          <h2 className="ad-h2">Customer</h2>
          <dl className="ad-dl">
            <dt>Name</dt><dd>{o.customer.name}</dd>
            <dt>Email</dt><dd>{o.customer.email}</dd>
            <dt>Phone</dt><dd>{o.customer.phone || '—'}</dd>
          </dl>
          <h2 className="ad-h2">Shipping</h2>
          <dl className="ad-dl">
            <dt>Address</dt><dd>{addr.address || '—'}</dd>
            <dt>City</dt><dd>{addr.city || '—'}</dd>
            <dt>State / Region</dt><dd>{addr.state || '—'}</dd>
            <dt>Postal code</dt><dd>{addr.postalCode || '—'}</dd>
            <dt>Country</dt><dd>{o.country || '—'}</dd>
            <dt>Method</dt><dd>{o.shippingMethod}</dd>
          </dl>
        </div>

        <div className="ad-card">
          <h2 className="ad-h2">Payment</h2>
          <dl className="ad-dl">
            <dt>Method</dt><dd>{METHOD_LABELS[o.paymentMethod] || o.paymentMethod}</dd>
            <dt>Status</dt><dd><Pill value={o.paymentStatus} /></dd>
          </dl>

          {o.paymentMethod !== 'card_teb' && !settled && (
            <div className="ad-filters" style={{ marginTop: '0.25rem', marginBottom: '0.75rem' }}>
              <label className="ad-field__label" htmlFor="ord-method">Change method</label>
              <select
                id="ord-method"
                value={chosenMethod}
                disabled={busy}
                onChange={(e) => setMethodDraft(e.target.value)}
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash_on_delivery">Cash on delivery</option>
              </select>
              <button
                className="ad-btn"
                disabled={busy || chosenMethod === o.paymentMethod}
                onClick={changeMethod}
              >
                Change
              </button>
            </div>
          )}
          {o.payments.length > 0 && (
            <Table
              rowKey={(p) => p.id}
              columns={[
                { key: 'id', header: 'ID' },
                { key: 'provider', header: 'Provider' },
                { key: 'status', header: 'Status', render: (p) => <Pill value={p.status} /> },
                { key: 'amountCents', header: 'Amount', render: (p) => money(p.amountCents, p.currency) },
                { key: 'providerReference', header: 'Reference', render: (p) => p.providerReference || '—' },
                { key: 'updatedAt', header: 'Updated', render: (p) => dt(p.updatedAt) },
              ]}
              rows={o.payments}
            />
          )}
          {isOffline && o.paymentStatus !== 'paid' && o.paymentStatus !== 'refunded' && (
            <div className="ad-actions-row">
              <ConfirmButton label="Confirm payment received" confirmLabel="Mark paid" busy={busy} onConfirm={confirmPayment} />
            </div>
          )}
          {o.paymentMethod === 'card_teb' && (
            <p className="ad-muted">Card payments are confirmed automatically by the payment provider and cannot be marked paid here.</p>
          )}

          <h2 className="ad-h2">Fulfillment</h2>
          <p><Pill value={o.fulfillmentStatus} /></p>
          <div className="ad-actions-row">
            {(NEXT_FULFILLMENT[o.fulfillmentStatus] || []).length === 0
              ? <span className="ad-muted">No further transitions.</span>
              : NEXT_FULFILLMENT[o.fulfillmentStatus].map((to) => (
                to === 'cancelled'
                  ? <ConfirmButton key={to} label="Cancel order" danger confirmLabel="Cancel" busy={busy} onConfirm={() => setFulfillment('cancelled')} />
                  : <button key={to} className="ad-btn" disabled={busy} onClick={() => setFulfillment(to)}>Mark {to}</button>
              ))}
          </div>
        </div>
      </div>

      <div className="ad-card">
        <h2 className="ad-h2">Items</h2>
        <Table
          rowKey={(it) => it.id}
          columns={[
            { key: 'name', header: 'Product' },
            { key: 'productId', header: 'Product ID', render: (it) => it.productId ?? '—' },
            { key: 'size', header: 'Size', render: (it) => it.size || '—' },
            { key: 'quantity', header: 'Qty' },
            { key: 'unitPriceCents', header: 'Unit', render: (it) => money(it.unitPriceCents, o.totals.currency) },
            { key: 'subtotalCents', header: 'Subtotal', render: (it) => money(it.subtotalCents, o.totals.currency) },
          ]}
          rows={o.items}
        />
        <table className="ad-summary">
          <tbody>
            <tr><td>Subtotal</td><td>{money(o.totals.subtotalCents, o.totals.currency)}</td></tr>
            <tr><td>Shipping</td><td>{money(o.totals.shippingCents, o.totals.currency)}</td></tr>
            <tr><td>Discount</td><td>{money(o.totals.discountCents, o.totals.currency)}</td></tr>
            <tr><td>Tax</td><td>{money(o.totals.taxCents, o.totals.currency)}</td></tr>
            <tr className="ad-summary__total"><td>Total</td><td>{money(o.totals.totalCents, o.totals.currency)}</td></tr>
          </tbody>
        </table>
        <p className="ad-muted">Placed {dt(o.createdAt)} · currency {o.totals.currency.toUpperCase()}</p>
      </div>
    </div>
  );
}
