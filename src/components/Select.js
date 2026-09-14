import React, { useEffect, useId, useRef, useState } from 'react';
import './Select.css';

/**
 * A styled single-select combobox (listbox pattern) that replaces the
 * browser's native <select> popup — which cannot be styled and can open
 * upward when there isn't room below, both of which read as "cheap" next to
 * BUKUR's custom-built fields. The panel always opens downward.
 *
 * Drop-in for a native <select>: same controlled {name, value, onChange}
 * contract (onChange/onBlur receive a shaped `{ target: { name, value } }}`
 * event, so it works unmodified with a handler written for a real <select>),
 * same keyboard behaviour (arrow keys, Home/End, typeahead, Enter/Escape).
 */
const Select = ({
  id,
  name,
  value,
  onChange,
  onBlur,
  options,
  required,
  autoComplete,
  ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(options.findIndex((o) => o.value === value), 0)
  );
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const typeaheadRef = useRef({ buffer: '', timer: null });
  const reactId = useId();
  const listboxId = `${id || name || reactId}-listbox`;

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const onDocPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) setActiveIndex(Math.max(options.findIndex((o) => o.value === value), 0));
  }, [open, value, options]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const commit = (index) => {
    const opt = options[index];
    if (!opt) return;
    onChange?.({ target: { name, value: opt.value } });
  };

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const runTypeahead = (char) => {
    const ta = typeaheadRef.current;
    clearTimeout(ta.timer);
    ta.buffer += char.toLowerCase();
    const startFrom = open ? activeIndex : Math.max(options.findIndex((o) => o.value === value), 0);
    const match =
      options.findIndex(
        (o, i) => i > startFrom && o.label.toLowerCase().startsWith(ta.buffer)
      ) >= 0
        ? options.findIndex((o, i) => i > startFrom && o.label.toLowerCase().startsWith(ta.buffer))
        : options.findIndex((o) => o.label.toLowerCase().startsWith(ta.buffer));
    ta.timer = setTimeout(() => { ta.buffer = ''; }, 600);
    if (match >= 0) {
      if (open) setActiveIndex(match);
      else commit(match);
    }
  };

  const onButtonKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActiveIndex((i) => {
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        return (i + delta + options.length) % options.length;
      });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) { commit(activeIndex); close(); } else setOpen(true);
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); close(); }
    } else if (e.key === 'Home' && open) {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End' && open) {
      e.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (e.key === 'Tab') {
      if (open) close(false);
    } else if (e.key.length === 1 && e.key !== ' ') {
      runTypeahead(e.key);
    }
  };

  const handleWrapBlur = (e) => {
    if (wrapRef.current && wrapRef.current.contains(e.relatedTarget)) return;
    setOpen(false);
    onBlur?.({ target: { name, value } });
  };

  return (
    <div className={`select ${open ? 'is-open' : ''}`} ref={wrapRef} onBlur={handleWrapBlur}>
      <button
        type="button"
        id={id}
        ref={buttonRef}
        className="select__btn"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-opt-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-required={required || undefined}
        aria-autocomplete="none"
        autoComplete={autoComplete}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
      >
        <span>{selected?.label ?? ''}</span>
        <svg className="select__chevron" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="select__panel" role="listbox" id={listboxId} tabIndex={-1} ref={listRef}>
          {options.map((opt, i) => (
            <li
              key={opt.value}
              id={`${listboxId}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={opt.value === value}
              className={`select__opt ${i === activeIndex ? 'is-active' : ''} ${opt.value === value ? 'is-selected' : ''}`}
              onPointerEnter={() => setActiveIndex(i)}
              onClick={() => { commit(i); close(); }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Select;
