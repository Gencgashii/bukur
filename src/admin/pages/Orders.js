import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync, Spinner, Msg, Table, Pager, Pill, money, dt } from '../components/ui';

export default function Orders() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [pay, setPay] = useState('');
  const [ful, setFul] = useState('');
  const [method, setMethod] = useState('');

  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: '25' });
    if (q) p.set('search', q);
    if (pay) p.set('paymentStatus', pay);
    if (ful) p.set('fulfillmentStatus', ful);
    if (method) p.set('paymentMethod', method);
    return `?${p.toString()}`;
  }, [page, q, pay, ful, method]);

  const list = useAsync(() => api.orders(qs), [qs]);

  return (
    <div className="ad-page">
      <h1 className="ad-h1">Orders</h1>
      <form className="ad-filters" onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(search.trim()); }}>
        <input placeholder="Order # or customer" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={pay} onChange={(e) => { setPage(1); setPay(e.target.value); }}>
          <option value="">Any payment</option>
          {['unpaid', 'pending', 'paid', 'failed', 'cancelled', 'refunded'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={ful} onChange={(e) => { setPage(1); setFul(e.target.value); }}>
          <option value="">Any fulfillment</option>
          {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={method} onChange={(e) => { setPage(1); setMethod(e.target.value); }}>
          <option value="">Any method</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="cash_on_delivery">Cash on delivery</option>
          <option value="card_teb">Card (TEB)</option>
        </select>
        <button className="ad-btn" type="submit">Search</button>
      </form>

      <Msg kind="error">{list.error}</Msg>
      {list.loading ? <Spinner label="Loading orders…" /> : (
        <>
          <Table
            rowKey={(r) => r.id}
            empty="No orders match."
            columns={[
              { key: 'number', header: 'Order #', render: (r) => <Link className="ad-link" to={`/admin/orders/${r.id}`}>{r.number}</Link> },
              { key: 'createdAt', header: 'Date', render: (r) => dt(r.createdAt) },
              { key: 'customer', header: 'Customer', render: (r) => <span>{r.customer.name}<br /><small className="ad-muted">{r.customer.email}</small></span> },
              { key: 'total', header: 'Total', render: (r) => money(r.totalCents, r.currency) },
              { key: 'paymentStatus', header: 'Payment', render: (r) => <Pill value={r.paymentStatus} /> },
              { key: 'fulfillmentStatus', header: 'Fulfillment', render: (r) => <Pill value={r.fulfillmentStatus} /> },
              { key: 'paymentMethod', header: 'Method' },
            ]}
            rows={list.data?.orders || []}
          />
          <Pager page={list.data?.page || 1} total={list.data?.total || 0} limit={list.data?.limit || 25} onPage={setPage} />
        </>
      )}
    </div>
  );
}
