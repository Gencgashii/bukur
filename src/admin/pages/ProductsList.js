import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync, Spinner, Msg, Table, Pager, Pill, ConfirmButton, money, dt } from '../components/ui';

export default function ProductsList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState('');
  const [stock, setStock] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);

  const cats = useAsync(() => api.categories(), []);
  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: '20' });
    if (q) p.set('search', q);
    if (category) p.set('categoryId', category);
    if (active) p.set('active', active);
    if (stock) p.set('stock', stock);
    if (showArchived) p.set('archived', 'true');
    return `?${p.toString()}`;
  }, [page, q, category, active, stock, showArchived]);

  const list = useAsync(() => api.products(qs), [qs]);

  const doArchive = async (p) => {
    setBusyId(p.id); setErr(''); setMsg('');
    try {
      if (p.archived) { await api.unarchiveProduct(p.id); setMsg(`"${p.title}" restored.`); }
      else { await api.archiveProduct(p.id); setMsg(`"${p.title}" archived.`); }
      list.reload();
    } catch (e) { setErr(e.message); } finally { setBusyId(null); }
  };
  const doDelete = async (p) => {
    setBusyId(p.id); setErr(''); setMsg('');
    try {
      await api.deleteProduct(p.id);
      setMsg(`"${p.title}" deleted.`);
      list.reload();
    } catch (e) { setErr(e.message); } finally { setBusyId(null); }
  };

  return (
    <div className="ad-page">
      <div className="ad-page__head">
        <h1 className="ad-h1">Products</h1>
        <Link className="ad-btn ad-btn--primary" to="/admin/products/new">+ New product</Link>
      </div>

      <form
        className="ad-filters"
        onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(search.trim()); }}
      >
        <input placeholder="Search name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={category} onChange={(e) => { setPage(1); setCategory(e.target.value); }}>
          <option value="">All categories</option>
          {(cats.data?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={active} onChange={(e) => { setPage(1); setActive(e.target.value); }}>
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select value={stock} onChange={(e) => { setPage(1); setStock(e.target.value); }}>
          <option value="">Any stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <label className="ad-check"><input type="checkbox" checked={showArchived} onChange={(e) => { setPage(1); setShowArchived(e.target.checked); }} /> Archived</label>
        <button className="ad-btn" type="submit">Search</button>
      </form>

      <Msg kind="success">{msg}</Msg>
      <Msg kind="error">{err || list.error}</Msg>

      {list.loading ? <Spinner label="Loading products…" /> : (
        <>
          <Table
            rowKey={(r) => r.id}
            empty="No products match."
            columns={[
              { key: 'image', header: '', width: '48px', render: (r) => r.thumbnail ? <img className="ad-thumb" src={r.thumbnail} alt="" /> : <div className="ad-thumb ad-thumb--empty" /> },
              { key: 'title', header: 'Name', render: (r) => <Link className="ad-link" to={`/admin/products/${r.id}/edit`}>{r.title}</Link> },
              { key: 'sku', header: 'SKU', render: (r) => r.sku || '—' },
              { key: 'category', header: 'Category', render: (r) => r.category?.name || '—' },
              { key: 'price', header: 'Price', render: (r) => money(r.priceCents, r.currency) },
              { key: 'stock', header: 'Stock', render: (r) => (r.trackInventory ? <span className={r.lowStock ? 'ad-danger' : ''}>{r.stock}</span> : '∞') },
              { key: 'status', header: 'Status', render: (r) => <Pill value={r.archived ? 'archived' : r.active ? 'active' : 'inactive'} /> },
              { key: 'flags', header: 'Flags', render: (r) => [r.featured && 'Featured', r.newArrival && 'New'].filter(Boolean).join(', ') || '—' },
              { key: 'updatedAt', header: 'Updated', render: (r) => dt(r.updatedAt) },
              {
                key: 'actions', header: '', render: (r) => (
                  <div className="ad-row-actions">
                    <Link className="ad-btn ad-btn--sm" to={`/admin/products/${r.id}/edit`}>Edit</Link>
                    <ConfirmButton
                      label={r.archived ? 'Restore' : 'Archive'}
                      confirmLabel={r.archived ? 'Restore' : 'Archive'}
                      busy={busyId === r.id}
                      onConfirm={() => doArchive(r)}
                    />
                    <ConfirmButton label="Delete" danger confirmLabel="Delete" busy={busyId === r.id} onConfirm={() => doDelete(r)} />
                  </div>
                ),
              },
            ]}
            rows={list.data?.products || []}
          />
          <Pager page={list.data?.page || 1} total={list.data?.total || 0} limit={list.data?.limit || 20} onPage={setPage} />
        </>
      )}
    </div>
  );
}
