import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync, Spinner, Msg, Field, ConfirmButton, money } from '../components/ui';

const BLANK = {
  title: '', description: '', sku: '', priceEuros: '', categoryId: '',
  sizes: '', trackInventory: false, stock: '0', lowStockThreshold: '3',
  featured: false, newArrival: false, active: true, images: [],
};

export default function ProductForm({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';
  const cats = useAsync(() => api.categories(), []);
  const loaded = useAsync(() => (isEdit ? api.product(id) : Promise.resolve(null)), [id, isEdit]);

  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [adjust, setAdjust] = useState({ delta: '', reason: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (isEdit && loaded.data?.product) {
      const p = loaded.data.product;
      setForm({
        title: p.title || '',
        description: p.description || '',
        sku: p.sku || '',
        priceEuros: (p.priceCents / 100).toFixed(2),
        categoryId: p.categoryId ? String(p.categoryId) : '',
        sizes: (p.sizes || []).join(', '),
        trackInventory: !!p.trackInventory,
        stock: String(p.stock ?? 0),
        lowStockThreshold: String(p.lowStockThreshold ?? 3),
        featured: !!p.featured,
        newArrival: !!p.newArrival,
        active: !!p.active,
        images: (p.imageList || []).map((im) => im.url),
      });
    }
  }, [isEdit, loaded.data]);

  const payload = useMemo(() => ({
    title: form.title.trim(),
    description: form.description,
    sku: form.sku.trim(),
    price: Number(form.priceEuros || 0),
    categoryId: form.categoryId ? Number(form.categoryId) : null,
    sizes: form.sizes.split(',').map((s) => s.trim()).filter(Boolean),
    trackInventory: form.trackInventory,
    stock: Math.max(0, Math.trunc(Number(form.stock) || 0)),
    lowStockThreshold: Math.max(0, Math.trunc(Number(form.lowStockThreshold) || 0)),
    featured: form.featured,
    newArrival: form.newArrival,
    active: form.active,
    images: form.images.map((url, position) => ({ url, position })),
  }), [form]);

  const onUpload = async (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    setUploading(true); setErr('');
    try {
      const r = await api.upload(files);
      set('images', [...form.images, ...r.files.map((f) => f.url)]);
      setMsg(`${r.files.length} image(s) uploaded${r.storageDriver ? ` (${r.storageDriver})` : ''}.`);
    } catch (e2) { setErr(e2.message); } finally { setUploading(false); e.target.value = ''; }
  };
  const removeImage = (i) => set('images', form.images.filter((_, x) => x !== i));
  const moveImage = (i, dir) => {
    const arr = [...form.images];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set('images', arr);
  };

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      if (isEdit) {
        await api.updateProduct(id, payload);
        setMsg('Product saved.');
        loaded.reload();
      } else {
        const r = await api.createProduct(payload);
        navigate(`/admin/products/${r.product.id}/edit`, { replace: true });
      }
    } catch (e2) {
      setErr(e2.message + (e2.details?.missingEnv ? ` (${e2.details.missingEnv.join(', ')})` : ''));
    } finally { setBusy(false); }
  };

  const runAdjust = async (e) => {
    e.preventDefault();
    const d = Number(adjust.delta);
    if (!Number.isInteger(d) || d === 0) { setErr('Adjustment must be a non-zero whole number.'); return; }
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await api.adjustInventory(id, d, adjust.reason.trim());
      setMsg(`Stock ${d > 0 ? '+' : ''}${d}: ${r.quantityBefore} → ${r.quantityAfter}.`);
      setAdjust({ delta: '', reason: '' });
      loaded.reload();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  if (isEdit && loaded.loading) return <Spinner label="Loading product…" />;
  if (isEdit && loaded.error) return <Msg kind="error">{loaded.error}</Msg>;
  const current = loaded.data?.product;

  return (
    <div className="ad-page">
      <div className="ad-page__head">
        <h1 className="ad-h1">{isEdit ? `Edit: ${current?.title || ''}` : 'New product'}</h1>
        <Link className="ad-btn ad-btn--ghost" to="/admin/products">← Back to products</Link>
      </div>

      <Msg kind="success">{msg}</Msg>
      <Msg kind="error">{err}</Msg>

      <form className="ad-form2col" onSubmit={save}>
        <div className="ad-form-section">
          <h2 className="ad-h2">Basic information</h2>
          <Field label="Product name"><input value={form.title} onChange={(e) => set('title', e.target.value)} required maxLength={160} /></Field>
          <Field label="SKU" hint="Optional, must be unique."><input value={form.sku} onChange={(e) => set('sku', e.target.value)} maxLength={60} /></Field>
          <Field label="Price (EUR)"><input type="number" min="0" step="0.01" value={form.priceEuros} onChange={(e) => set('priceEuros', e.target.value)} required /></Field>
          <Field label="Category">
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">— none —</option>
              {(cats.data?.categories || []).filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Description" hint="Plain text only (no HTML).">
            <textarea rows={6} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={8000} />
          </Field>
        </div>

        <div className="ad-form-section">
          <h2 className="ad-h2">Sizes</h2>
          <Field label="Available sizes" hint="Comma separated, e.g. 36, 37, 38, 39, 40. Leave blank for one-size. Only these values are shown to customers.">
            <input value={form.sizes} onChange={(e) => set('sizes', e.target.value)} placeholder="36, 37, 38, 39, 40" />
          </Field>

          <h2 className="ad-h2">Inventory</h2>
          <label className="ad-check"><input type="checkbox" checked={form.trackInventory} onChange={(e) => set('trackInventory', e.target.checked)} /> Track inventory (block orders at 0 stock)</label>
          <Field label="Stock quantity" hint={isEdit ? 'Prefer the adjustment tool below for +/- changes (keeps an audit trail).' : ''}>
            <input type="number" min="0" step="1" value={form.stock} onChange={(e) => set('stock', e.target.value)} />
          </Field>
          <Field label="Low-stock threshold"><input type="number" min="0" step="1" value={form.lowStockThreshold} onChange={(e) => set('lowStockThreshold', e.target.value)} /></Field>

          <h2 className="ad-h2">Visibility</h2>
          <label className="ad-check"><input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> Active (visible in storefront)</label>
          <label className="ad-check"><input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured</label>
          <label className="ad-check"><input type="checkbox" checked={form.newArrival} onChange={(e) => set('newArrival', e.target.checked)} /> New arrival</label>
        </div>

        <div className="ad-form-section ad-form-section--full">
          <h2 className="ad-h2">Images</h2>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" multiple onChange={onUpload} disabled={uploading} />
          {uploading && <span className="ad-muted"> uploading…</span>}
          <div className="ad-images">
            {form.images.map((url, i) => (
              <div className="ad-image" key={url + i}>
                <img src={url} alt="" />
                {i === 0 && <span className="ad-image__primary">Primary</span>}
                <div className="ad-image__ctrls">
                  <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0}>←</button>
                  <button type="button" onClick={() => moveImage(i, 1)} disabled={i === form.images.length - 1}>→</button>
                  <button type="button" className="ad-danger" onClick={() => removeImage(i)}>✕</button>
                </div>
              </div>
            ))}
            {form.images.length === 0 && <p className="ad-muted">No images yet. The first image is the primary.</p>}
          </div>
        </div>

        <div className="ad-form-actions ad-form-section--full">
          <button className="ad-btn ad-btn--primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </form>

      {isEdit && (
        <div className="ad-card">
          <h2 className="ad-h2">Inventory adjustment</h2>
          <p className="ad-muted">Current stock: <strong>{current?.stock}</strong>{current?.trackInventory ? '' : ' (tracking off)'}. Enter a positive or negative whole number.</p>
          <form className="ad-inline-form" onSubmit={runAdjust}>
            <input type="number" step="1" placeholder="+5 or -3" value={adjust.delta} onChange={(e) => setAdjust((a) => ({ ...a, delta: e.target.value }))} />
            <input placeholder="Reason (optional)" value={adjust.reason} onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))} maxLength={200} />
            {Math.abs(Number(adjust.delta)) >= 50
              ? <ConfirmButton label="Apply large adjustment" confirmLabel="Apply" busy={busy} onConfirm={() => runAdjust({ preventDefault() {} })} />
              : <button className="ad-btn" type="submit" disabled={busy}>Apply</button>}
          </form>
          <p className="ad-muted">Full history: <Link className="ad-link" to={`/admin/inventory`}>Inventory → adjustments</Link></p>
        </div>
      )}

      {isEdit && current && (
        <p className="ad-muted">Preview URL: <code>/product/{current.id}</code> — {current.active ? 'live in storefront' : 'hidden (inactive)'}.</p>
      )}
      <p className="ad-muted">{isEdit && current ? money(current.priceCents, current.currency) : ''}</p>
    </div>
  );
}
