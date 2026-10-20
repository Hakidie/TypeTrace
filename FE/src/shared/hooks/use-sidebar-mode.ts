import { useSyncExternalStore } from 'react';

export type SidebarMode = 'default' | 'compact';

const STORAGE_KEY = 'sidebarMode';
const listeners = new Set<() => void>();

const read = (): SidebarMode => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'compact' ? 'compact' : 'default';
  } catch {
    return 'default';
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The admin sidebar mode, kept in the browser (like the theme). Any component can read it, e.g. the sidebar. */
export const useSidebarMode = () => {
  const mode = useSyncExternalStore(subscribe, read);

  const setMode = (next: SidebarMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice just won't be remembered.
    }
    listeners.forEach((listener) => listener());
  };

  return { mode, setMode };
};
