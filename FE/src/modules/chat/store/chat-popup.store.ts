import { useSyncExternalStore } from 'react';

/** Whether the chat popup is open. The menu item in the account menu toggles it; `ChatWidget` draws it. */
let open = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const chatPopupStore = {
  get: () => open,
  set: (next: boolean) => {
    if (open === next) return;
    open = next;
    emit();
  },
  toggle: () => chatPopupStore.set(!open),
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const useChatPopupOpen = () => useSyncExternalStore(chatPopupStore.subscribe, chatPopupStore.get);
