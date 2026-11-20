import { useCallback, useSyncExternalStore } from 'react';
import type { TypingLanguage } from '@/shared/lib/typing-language';

const listeners = new Set<() => void>();
/**
 * Vietnamese on every visit: a guest's choice is kept only while the page stays open (nothing is saved), but outside the
 * page, so it is still there when `AppLayout` draws the page again in the language of the interface, which the language
 * button changes too (SCRUM-319).
 */
let current: TypingLanguage = 'vi';

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

const emit = () => listeners.forEach((listener) => listener());

/** The language a guest types on the Typing page (VI / EN), and the function that changes it. */
export const useGuestTypingLanguage = () => {
  const language = useSyncExternalStore(subscribe, () => current);
  const setLanguage = useCallback((next: TypingLanguage) => {
    current = next;
    emit();
  }, []);
  return [language, setLanguage] as const;
};

/** For tests: sets the guest's language (Vietnamese without an argument). */
export const resetGuestTypingLanguage = (language: TypingLanguage = 'vi') => {
  current = language;
  emit();
};
