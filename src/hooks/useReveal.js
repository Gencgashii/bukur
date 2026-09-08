import { useEffect, useRef } from 'react';

/**
 * Adds `is-in` to the element when it scrolls into view (once). Pair with the
 * `.reveal` utility. A timeout fallback guarantees content is never left
 * hidden if IntersectionObserver is unavailable or throttled.
 */
export default function useReveal(options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const show = () => el.classList.add('is-in');

    if (typeof IntersectionObserver === 'undefined') {
      show();
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            show();
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05, ...options }
    );
    io.observe(el);

    // Safety net: never leave content invisible.
    const t = setTimeout(show, 2000);

    return () => { io.disconnect(); clearTimeout(t); };
  }, [options]);

  return ref;
}
