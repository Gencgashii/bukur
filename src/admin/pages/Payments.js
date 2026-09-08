import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync, Spinner, Msg, Table, Pager, Pill, ConfirmButton, money, dt } from '../components/ui';

export default function Payments() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [provider, setProvider] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: '25' });
    if (status) p.set('status', status);
    if (method) p.set('method', method);
    if (provider) p.set('provider', provider);
    return `?${p.toString()}`;
  }, [page, status, method, provider]);

  const list = useAsync(() => api.payments(qs), [qs]);

  const confirm = async (p) => {
    setBusyId(p.id); setErr(''); setMsg('');
    try { await api.confirmPayment(p.id, 'paid'); setMsg(`Payment #${p.id} marked paid.`); list.reload(); }
    catch (e) { setErr(e.message); } finally { setBusyId(null); }
  };

  return (
    <div className="ad-page">
      <h1 className="ad-h1">Payments</h1>
      <form className="ad-filters" onSubmit={(e) => e.preventDefault()}>
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Any status</option>
          {['unpaid', 'pending', 'paid', 'failed', 'cancelled', 'refunded'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={method} onChange={(e) => { setPage(1); setMethod(e.target.value); }}>
          <option value="">Any method</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="cash_on_delivery">Cash on delivery</option>
          <option value="card_teb">Card (TEB)</option>
        </select>
        <select value={provider} onChange={(e) => { setPage(1); setProvider(e.target.value); }}>
          <option value="">Any provider</option>
          <option value="offline">offline</option>
          <option value="mock">mock</option>
          <option value="teb">teb</option>
        </select>
      </form>

      <Msg kind="success">{msg}</Msg>
      <Msg kind="error">{err || list.error}</Msg>

      {list.loading ? <Spinner /> : (
        <>
          <Table
            rowKey={(r) => r.id}
            empty="No payments match."
            columns={[
              { key: 'id', header: 'ID' },
              { key: 'orderNumber', header: 'Order', render: (r) => <Link className="ad-link" to={`/admin/orders/${r.orderId}`}>{r.orderNumber}</Link> },
              { key: 'method', header: 'Method' },
              { key: 'provider', header: 'Provider' },
              { key: 'status', header: 'Status', render: (r) => <Pill value={r.status} /> },
              { key: 'amountCents', header: 'Amount', render: (r) => money(r.amountCents, r.currency) },
              { key: 'providerReference', header: 'Reference', render: (r) => r.providerReference || '—' },
              { key: 'updatedAt', header: 'Updated', render: (r) => dt(r.updatedAt) },
              {
                key: 'actions', header: '', render: (r) => (
                  (r.method === 'bank_transfer' || r.method === 'cash_on_delivery') && r.status !== 'paid' && r.status !== 'refunded'
                    ? <ConfirmButton label="Confirm" confirmLabel="Mark paid" busy={busyId === r.id} onConfirm={() => confirm(r)} />
                    : r.method === 'card_teb' ? <span className="ad-muted">provider-managed</span> : null
                ),
              },
            ]}
            rows={list.data?.payments || []}
          />
          <Pager page={list.data?.page || 1} total={list.data?.total || 0} limit={list.data?.limit || 25} onPage={setPage} />
        </>
      )}
      <p className="ad-muted">Card data is never stored or shown. Only the provider transaction reference is kept, for reconciliation.</p>
    </div>
  );
}
