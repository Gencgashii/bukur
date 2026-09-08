import React, { useMemo, useState } from 'react';
import { api } from '../api';
import { useAsync, Spinner, Msg, Table, Pager, Pill, money, dt } from '../components/ui';

export default function Customers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: '25' });
    if (q) p.set('search', q);
    return `?${p.toString()}`;
  }, [page, q]);
  const list = useAsync(() => api.customers(qs), [qs]);
  const detail = useAsync(() => (selected ? api.customer(selected) : Promise.resolve(null)), [selected]);

  return (
    <div className="ad-page">
      <h1 className="ad-h1">Customers</h1>
      <p className="ad-muted">Derived from order history. There are no customer login accounts in this phase.</p>
      <form className="ad-filters" onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(search.trim()); }}>
        <input placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="ad-btn" type="submit">Search</button>
      </form>

      <Msg kind="error">{list.error}</Msg>
      {list.loading ? <Spinner /> : (
        <>
          <Table
            rowKey={(r) => r.email}
            empty="No customers yet."
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'email', header: 'Email', render: (r) => <button className="ad-link ad-linkbtn" onClick={() => setSelected(r.email)}>{r.email}</button> },
              { key: 'phone', header: 'Phone', render: (r) => r.phone || '—' },
              { key: 'orderCount', header: 'Orders' },
              { key: 'totalSpentCents', header: 'Total spent', render: (r) => money(r.totalSpentCents) },
              { key: 'lastOrderAt', header: 'Last order', render: (r) => dt(r.lastOrderAt) },
            ]}
            rows={list.data?.customers || []}
          />
          <Pager page={list.data?.page || 1} total={9999} limit={list.data?.limit || 25} onPage={setPage} />
        </>
      )}

      {selected && (
        <div className="ad-card">
          <div className="ad-card__head">
            <h2 className="ad-h2">{selected}</h2>
            <button className="ad-btn ad-btn--ghost" onClick={() => setSelected(null)}>Close</button>
          </div>
          {detail.loading ? <Spinner /> : detail.error ? <Msg kind="error">{detail.error}</Msg> : detail.data && (
            <>
              <dl className="ad-dl">
                <dt>Name</dt><dd>{detail.data.customer.name}</dd>
                <dt>Phone</dt><dd>{detail.data.customer.phone || '—'}</dd>
                <dt>Orders</dt><dd>{detail.data.customer.orderCount}</dd>
                <dt>Total spent</dt><dd>{money(detail.data.customer.totalSpentCents)}</dd>
              </dl>
              <Table
                rowKey={(r) => r.id}
                columns={[
                  { key: 'number', header: 'Order' },
                  { key: 'createdAt', header: 'Date', render: (r) => dt(r.createdAt) },
                  { key: 'totalCents', header: 'Total', render: (r) => money(r.totalCents, r.currency) },
                  { key: 'paymentStatus', header: 'Payment', render: (r) => <Pill value={r.paymentStatus} /> },
                  { key: 'fulfillmentStatus', header: 'Fulfillment', render: (r) => <Pill value={r.fulfillmentStatus} /> },
                ]}
                rows={detail.data.orders}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
