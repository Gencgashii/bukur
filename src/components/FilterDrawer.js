import React, { useEffect } from 'react';
import './FilterDrawer.css';

const FilterDrawer = ({
  open,
  onClose,
  categories = [],
  sizes = [],
  value,
  onChange,
  onReset,
  resultCount,
}) => {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const toggleSize = (s) => {
    const next = value.sizes.includes(s)
      ? value.sizes.filter((x) => x !== s)
      : [...value.sizes, s];
    onChange({ ...value, sizes: next });
  };

  return (
    <>
      <div className={`fdrawer__scrim ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`fdrawer ${open ? 'is-open' : ''}`} aria-label="Filter" aria-hidden={!open}>
        <div className="fdrawer__head">
          <span className="u-fine">Filter</span>
          <button className="fdrawer__close" onClick={onClose} aria-label="Close filters">Close</button>
        </div>

        <div className="fdrawer__body">
          <div className="fdrawer__group">
            <h3 className="fdrawer__label">Category</h3>
            <div className="fdrawer__chips">
              <button
                className={`fchip ${!value.category ? 'is-on' : ''}`}
                onClick={() => onChange({ ...value, category: '' })}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  className={`fchip ${value.category === c ? 'is-on' : ''}`}
                  onClick={() => onChange({ ...value, category: value.category === c ? '' : c })}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {sizes.length > 0 && (
            <div className="fdrawer__group">
              <h3 className="fdrawer__label">Size</h3>
              <div className="fdrawer__chips">
                {sizes.map((s) => (
                  <button
                    key={s}
                    className={`fchip fchip--sq ${value.sizes.includes(s) ? 'is-on' : ''}`}
                    onClick={() => toggleSize(s)}
                    aria-pressed={value.sizes.includes(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="fdrawer__group">
            <h3 className="fdrawer__label">Price</h3>
            <div className="fdrawer__chips">
              {[
                { k: '', label: 'Any' },
                { k: '0-350', label: 'Under €350' },
                { k: '350-400', label: '€350 – €400' },
                { k: '400-9999', label: '€400 +' },
              ].map((b) => (
                <button
                  key={b.k}
                  className={`fchip ${value.price === b.k ? 'is-on' : ''}`}
                  onClick={() => onChange({ ...value, price: value.price === b.k ? '' : b.k })}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="fdrawer__group">
            <label className="fdrawer__check">
              <input
                type="checkbox"
                checked={value.inStockOnly}
                onChange={(e) => onChange({ ...value, inStockOnly: e.target.checked })}
              />
              <span>Available now only</span>
            </label>
          </div>
        </div>

        <div className="fdrawer__foot">
          <button className="link-underline link-quiet" onClick={onReset}>Reset</button>
          <button className="btn btn--sm" onClick={onClose}>
            View {resultCount} {resultCount === 1 ? 'style' : 'styles'}
          </button>
        </div>
      </aside>
    </>
  );
};

export default FilterDrawer;
