import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync, Spinner, Msg, Table, Pill, dt } from '../components/ui';

function AdjustCell({ row, onDone }) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const apply = async (e) => {
    e.preventDefault();
    const d = Number(delta);
    if (!Number.isInteger(d) || d === 0) { setErr('Whole non-zero number.'); return; }
    setBusy(true); setErr('');
    try {
      await api.adjustInventory(row.id, d, reason.trim());
      setDelta(''); setReason('');
      onDone();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <form className="ad-inline-form ad-inline-form--sm" onSubmit={apply}>
      <input type="number" step="1" placeholder="+/-" value={delta} onChange={(e) => setDelta(e.target.value)} style={{ width: 64 }} />
      <input placeholder="reason" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: 120 }} />
      <button className="ad-btn ad-btn--sm" disabled={busy}>{busy ? '…' : 'Apply'}</button>
      {err && <span className="ad-field__error">{err}</span>}
    </form>
  );
}

export default function Inventory() {
  const [tab, setTab] = useState('stock');
  const inv = useAsync(() => api.inventory('?limit=200'), []);
  const [msg, setMsg] = useState('');
  const adjustments = useAsync(() => api.adjustments('?limit=100'), [tab === 'history']);

  return (
    <div className="ad-page">
      <h1 className="ad-h1">Inventory</h1>
      <div className="ad-tabs">
        <button className={tab === 'stock' ? 'is-active' : ''} onClick={() => setTab('stock')}>Stock levels</button>
        <button className={tab === 'history' ? 'is-active' : ''} onClick={() => { setTab('history'); adjustments.reload(); }}>Adjustment history</button>
      </div>

      <Msg kind="success">{msg}</Msg>

      {tab === 'stock' && (inv.loading ? <Spinner /> : inv.error ? <Msg kind="error">{inv.error}</Msg> : (
        <Table
          rowKey={(r) => r.id}
          columns={[
            { key: 'title', header: 'Product', render: (r) => <Link className="ad-link" to={`/admin/products/${r.id}/edit`}>{r.title}</Link> },
            { key: 'sku', header: 'SKU', render: (r) => r.sku || '—' },
            { key: 'stock', header: 'Stock', render: (r) => <strong className={r.lowStock ? 'ad-danger' : ''}>{r.stock}</strong> },
            { key: 'trackInventory', header: 'Tracking', render: (r) => (r.trackInventory ? 'On' : 'Off') },
            { key: 'lowStockThreshold', header: 'Threshold' },
            { key: 'status', header: 'Status', render: (r) => <Pill value={r.active ? 'active' : 'inactive'} /> },
            { key: 'adjust', header: 'Adjust', render: (r) => <AdjustCell row={r} onDone={() => { setMsg(`Stock updated for "${r.title}".`); inv.reload(); }} /> },
          ]}
          rows={inv.data?.items || []}
        />
      ))}

      {tab === 'history' && (adjustments.loading ? <Spinner /> : adjustments.error ? <Msg kind="error">{adjustments.error}</Msg> : (
        <Table
          rowKey={(r) => r.id}
          empty="No manual adjustments recorded yet."
          columns={[
            { key: 'createdAt', header: 'When', render: (r) => dt(r.createdAt) },
            { key: 'productTitle', header: 'Product' },
            { key: 'adjustmentQuantity', header: 'Change', render: (r) => (r.adjustmentQuantity > 0 ? `+${r.adjustmentQuantity}` : r.adjustmentQuantity) },
            { key: 'quantityBefore', header: 'Before' },
            { key: 'quantityAfter', header: 'After' },
            { key: 'reason', header: 'Reason', render: (r) => r.reason || '—' },
            { key: 'adminEmail', header: 'By', render: (r) => r.adminEmail || '—' },
          ]}
          rows={adjustments.data?.adjustments || []}
        />
      ))}
    </div>
  );
}
