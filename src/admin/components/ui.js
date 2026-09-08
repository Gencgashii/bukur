import React, { useCallback, useEffect, useState } from 'react';

export const money = (cents, currency = 'EUR') => {
  const n = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: (currency || 'EUR').toUpperCase() }).format(n);
  } catch {
    return `€${n.toFixed(2)}`;
  }
};

export const dt = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

export function Spinner({ label = 'Loading…' }) {
  return <p className="ad-status" role="status">{label}</p>;
}

export function Msg({ kind = 'info', children }) {
  if (!children) return null;
  return <div className={`ad-msg ad-msg--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Pill({ value }) {
  const v = String(value || '').toLowerCase();
  return <span className={`ad-pill ad-pill--${v}`}>{value || '—'}</span>;
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="ad-field">
      <span className="ad-field__label">{label}</span>
      {children}
      {hint && <span className="ad-field__hint">{hint}</span>}
      {error && <span className="ad-field__error">{error}</span>}
    </label>
  );
}

/** Inline confirm — no window.confirm. */
export function ConfirmButton({ label, confirmLabel = 'Confirm', onConfirm, danger, disabled, busy }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);
  if (!armed) {
    return (
      <button type="button" className={danger ? 'ad-btn ad-btn--danger' : 'ad-btn'} disabled={disabled} onClick={() => setArmed(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="ad-confirm">
      <button type="button" className="ad-btn ad-btn--danger" disabled={busy} onClick={async () => { await onConfirm(); setArmed(false); }}>
        {busy ? '…' : confirmLabel}
      </button>
      <button type="button" className="ad-btn ad-btn--ghost" disabled={busy} onClick={() => setArmed(false)}>Cancel</button>
    </span>
  );
}

export function Table({ columns, rows, empty = 'Nothing to show.', rowKey }) {
  if (!rows || rows.length === 0) return <p className="ad-empty">{empty}</p>;
  return (
    <div className="ad-table-wrap">
      <table className="ad-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r) : i}>
              {columns.map((c) => <td key={c.key} data-label={c.header}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, total, limit, onPage }) {
  const pages = Math.max(1, Math.ceil((total || 0) / (limit || 1)));
  if (pages <= 1) return null;
  return (
    <div className="ad-pager">
      <button className="ad-btn ad-btn--ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</button>
      <span>Page {page} of {pages}</span>
      <button className="ad-btn ad-btn--ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</button>
    </div>
  );
}

/** Small data-loading hook with loading/error/reload. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const run = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    Promise.resolve()
      .then(fn)
      .then((data) => { if (alive) setState({ loading: false, error: '', data }); })
      .catch((e) => { if (alive) setState({ loading: false, error: e.message || 'Failed to load.', data: null }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  return { ...state, reload: run };
}
