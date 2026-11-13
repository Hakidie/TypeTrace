import { useSyncExternalStore } from 'react';

/** Whether a CSS media query matches now, and again whenever it changes (e.g. `(max-width: 767px)` for a phone). */
export const useMediaQuery = (query: string) =>
  useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener?.('change', onChange);
      return () => list.removeEventListener?.('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
