import { useEffect } from 'react';

let lockCount = 0;

/**
 * useScrollLock(active)
 *
 * Locks page scroll while `active` is true (drawers, the mobile menu,
 * search overlay, the PDP gallery lightbox). Hiding <body>'s scrollbar
 * shrinks the browser's own scrollbar track, which otherwise makes the
 * fixed header and centered page content visibly jump sideways by the
 * scrollbar's width the instant a panel opens. This measures that width
 * once and compensates for it (body padding + a CSS var `.hdr` reads) so
 * nothing shifts.
 *
 * Reference-counted so overlapping locks (e.g. the gallery lightbox opened
 * from inside a drawer) don't restore the wrong state when only the inner
 * one closes.
 */
export default function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    if (lockCount === 0) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.setProperty('--scrollbar-w', `${scrollbarWidth}px`);
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.documentElement.style.removeProperty('--scrollbar-w');
      }
    };
  }, [active]);
}
