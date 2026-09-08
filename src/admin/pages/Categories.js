import React, { useState } from 'react';
import { api } from '../api';
import { useAsync, Spinner, Msg, Table, ConfirmButton } from '../components/ui';

export default function Categories() {
  const { loading, error, data, reload } = useAsync(() => api.categories(), []);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true); setErr(''); setMsg('');
    try { await api.createCategory(name.trim()); setName(''); setMsg('Category created.'); reload(); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const saveEdit = async (id) => {
    setBusy(true); setErr(''); setMsg('');
    try { await api.updateCategory(id, editName.trim()); setEditId(null); setMsg('Category updated.'); reload(); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const toggleArchive = async (c) => {
    setBusy(true); setErr(''); setMsg('');
    try {
      if (c.archived) await api.unarchiveCategory(c.id); else await api.archiveCategory(c.id);
      setMsg(`Category ${c.archived ? 'restored' : 'archived'}.`); reload();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="ad-page">
      <h1 className="ad-h1">Categories</h1>
      <form className="ad-inline-form" onSubmit={create}>
        <input placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <button className="ad-btn ad-btn--primary" disabled={busy}>Add category</button>
      </form>
      <Msg kind="success">{msg}</Msg>
      <Msg kind="error">{err || error}</Msg>

      {loading ? <Spinner /> : (
        <Table
          rowKey={(r) => r.id}
          columns={[
            {
              key: 'name', header: 'Name', render: (c) => editId === c.id
                ? <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
                : <span className={c.archived ? 'ad-muted' : ''}>{c.name}</span>,
            },
            { key: 'slug', header: 'Slug' },
            { key: 'productCount', header: 'Products' },
            { key: 'archived', header: 'State', render: (c) => (c.archived ? 'Archived' : 'Active') },
            {
              key: 'actions', header: '', render: (c) => (
                <div className="ad-row-actions">
                  {editId === c.id ? (
                    <>
                      <button className="ad-btn ad-btn--sm" disabled={busy} onClick={() => saveEdit(c.id)}>Save</button>
                      <button className="ad-btn ad-btn--sm ad-btn--ghost" onClick={() => setEditId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="ad-btn ad-btn--sm" onClick={() => { setEditId(c.id); setEditName(c.name); }}>Rename</button>
                      <ConfirmButton
                        label={c.archived ? 'Restore' : 'Archive'}
                        confirmLabel={c.archived ? 'Restore' : 'Archive'}
                        busy={busy}
                        onConfirm={() => toggleArchive(c)}
                      />
                    </>
                  )}
                </div>
              ),
            },
          ]}
          rows={data?.categories || []}
        />
      )}
      <p className="ad-muted">Categories are archived, never hard-deleted, so products keep a valid reference.</p>
    </div>
  );
}
