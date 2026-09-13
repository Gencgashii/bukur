import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal/drawer behaviour for an overlay element.
 *
 *   const ref = useRef(null);
 *   useFocusTrap({ active: open, ref, onEscape: onClose });
 *
 * While `active`:
 *   - moves focus to the first focusable element inside `ref` (or the container)
 *   - keeps Tab / Shift+Tab cycling within `ref`
 *   - calls `onEscape` when Escape is pressed
 * On deactivate: restores focus to whatever was focused before it opened.
 *
 * `onEscape` is read through a ref, so passing a fresh inline callback each
 * render does not re-run the effect (no focus-jump on unrelated re-renders).
 * Purely additive — no visual change.
 */
export default function useFocusTrap({ active, ref, onEscape }) {
  const escRef = useRef(onEscape);
  escRef.current = onEscape;

  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const container = ref.current;
    const previouslyFocused = document.activeElement;

    const focusables = () =>
      Array.from(container.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    const first = focusables()[0];
    (first || container).focus?.();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        escRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      } else if (!container.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [active, ref]);
}
