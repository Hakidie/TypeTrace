import { useCallback, useSyncExternalStore } from 'react';

export type MinigameLang = 'en' | 'vi';

const listeners = new Set<() => void>();
/** English on every visit: the choice is kept only while the page stays open (nothing is saved in the browser). */
let current: MinigameLang = 'en';

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

const emit = () => listeners.forEach((listener) => listener());

/**
 * The language of the minigames' texts, English until the player switches, and English again on the next visit. It is one
 * value for every component that reads it: the tiles page, each game and the button that switches it all change together.
 */
export const useMinigameLang = () => {
  const lang = useSyncExternalStore(subscribe, () => current);
  const toggle = useCallback(() => {
    current = current === 'en' ? 'vi' : 'en';
    emit();
  }, []);
  return { lang, toggle };
};

/** For tests: sets the language (English without an argument). */
export const resetMinigameLang = (lang: MinigameLang = 'en') => {
  current = lang;
  emit();
};
