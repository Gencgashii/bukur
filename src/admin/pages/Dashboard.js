import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync, Spinner, Msg, Table, Pill, money, dt } from '../components/ui';

function Stat({ label, value, sub }) {
  return (
    <div className="ad-stat">
      <div className="ad-stat__value">{value}</div>
      <div className="ad-stat__label">{label}</div>
      {sub != null && <div className="ad-stat__sub">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { loading, error, data } = useAsync(() => api.dashboard(), []);
  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error) return <Msg kind="error">{error}</Msg>;

  const cur = data.sales.currency;
  return (
    <div className="ad-page">
      <h1 className="ad-h1">Dashboard</h1>

      <section className="ad-grid ad-grid--stats">
        <Stat label="Revenue (paid, all time)" value={money(data.sales.revenueTotalCents, cur)} />
        <Stat label="Revenue today" value={money(data.sales.revenueTodayCents, cur)} />
        <Stat label="Revenue this month" value={money(data.sales.revenueMonthCents, cur)} />
        <Stat label="Orders" value={data.orders.total} sub={`${data.orders.pending} pending · ${data.orders.paid} paid · ${data.orders.cancelled} cancelled`} />
        <Stat label="Products" value={data.products.total} sub={`${data.products.active} active`} />
        <Stat label="Out of stock" value={data.products.outOfStock} sub={`${data.products.lowStock} low stock`} />
      </section>

      <section className="ad-card">
        <div className="ad-card__head">
          <h2 className="ad-h2">Recent orders</h2>
          <Link className="ad-link" to="/admin/orders">View all →</Link>
        </div>
        <Table
          rowKey={(r) => r.id}
          empty="No orders yet."
          columns={[
            { key: 'number', header: 'Order', render: (r) => <Link className="ad-link" to={`/admin/orders/${r.id}`}>{r.number}</Link> },
            { key: 'customer', header: 'Customer', render: (r) => <span>{r.customer}<br /><small className="ad-muted">{r.email}</small></span> },
            { key: 'createdAt', header: 'Date', render: (r) => dt(r.createdAt) },
            { key: 'total', header: 'Total', render: (r) => money(r.totalCents, r.currency) },
            { key: 'paymentStatus', header: 'Payment', render: (r) => <Pill value={r.paymentStatus} /> },
            { key: 'fulfillmentStatus', header: 'Fulfillment', render: (r) => <Pill value={r.fulfillmentStatus} /> },
          ]}
          rows={data.recentOrders}
        />
      </section>

      <section className="ad-card">
        <div className="ad-card__head">
          <h2 className="ad-h2">Low stock</h2>
          <Link className="ad-link" to="/admin/inventory">Manage inventory →</Link>
        </div>
        <Table
          rowKey={(r) => r.id}
          empty="No tracked products are low on stock."
          columns={[
            { key: 'title', header: 'Product', render: (r) => <Link className="ad-link" to={`/admin/products/${r.id}/edit`}>{r.title}</Link> },
            { key: 'sku', header: 'SKU', render: (r) => r.sku || '—' },
            { key: 'stock', header: 'Stock' },
            { key: 'lowStockThreshold', header: 'Threshold' },
          ]}
          rows={data.lowStock}
        />
      </section>
    </div>
  );
}
