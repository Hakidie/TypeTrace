import { useSyncExternalStore } from 'react';

export type WardrobeVersion = 'classic' | 'modern';

const STORAGE_KEY = 'wardrobeVersion';
const listeners = new Set<() => void>();

const read = (): WardrobeVersion => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'modern' ? 'modern' : 'classic';
  } catch {
    return 'classic';
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Which wardrobe `/wardrobe` shows, kept in the browser (like the sidebar mode): Settings and the switch beside the wardrobe's title change it. */
export const useWardrobeVersion = () => {
  const version = useSyncExternalStore(subscribe, read);

  const setVersion = (next: WardrobeVersion) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice just won't be remembered.
    }
    listeners.forEach((listener) => listener());
  };

  return { version, setVersion };
};
