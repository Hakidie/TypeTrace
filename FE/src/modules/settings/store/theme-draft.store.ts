import { useSyncExternalStore } from 'react';
import type { ThemeColors, ThemeMode } from '@/shared/lib/theme';

/** A theme being made or edited in Settings and not saved yet. It is kept in memory, so it survives moving between pages and is lost on reload. */
export interface ThemeDraft {
  /** The mode the colors were made for. */
  mode: ThemeMode;
  /** `'new'` for a new theme, or the id of the theme being edited. */
  editingId: string;
  name: string;
  colors: ThemeColors;
}

let draft: ThemeDraft | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const themeDraftStore = {
  get: () => draft,
  set: (next: ThemeDraft) => {
    draft = next;
    emit();
  },
  /** Saved, cancelled, mode changed or logged out. */
  clear: () => {
    if (!draft) return;
    draft = null;
    emit();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const useThemeDraft = () => useSyncExternalStore(themeDraftStore.subscribe, themeDraftStore.get);
