import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { applyTheme, getStoredTheme, paintTheme, type ThemeColors, type ThemeMode } from '@/shared/lib/theme';
import { themesApi } from '../api/themes.api';
import { themeDraftStore, useThemeDraft } from '../store/theme-draft.store';
import type { ActiveThemes } from '../types/theme.types';
import { themeKeys, useActiveThemes } from './use-themes';

/** The colors of the theme chosen for the mode in use; `null` = the built-in palette of that mode. */
export const appliedColors = (active: ActiveThemes): ThemeColors | null => (active.mode === 'dark' ? active.dark : active.light)?.colors ?? null;

/** Keeps the page in step with the signed-in user's mode and chosen themes. Used once by each layout. */
export const useThemeSync = () => {
  const { data: active } = useActiveThemes();
  const draft = useThemeDraft();

  useEffect(() => {
    if (!active) return;
    // A theme being made in Settings shows live on every page until it is saved or cancelled (nothing is remembered for it).
    if (draft && draft.mode === active.mode) paintTheme(active.mode, draft.colors);
    else applyTheme(active.mode, appliedColors(active));
  }, [active, draft]);
};

/**
 * The mode in use (Light or Dark) and a way to change it. Signed in, the choice is saved on the account and the page follows
 * `useThemeSync`; on the login pages it is only remembered in the browser.
 */
export const useThemeMode = () => {
  const queryClient = useQueryClient();
  const { data: active } = useActiveThemes();
  const [localMode, setLocalMode] = useState<ThemeMode>(() => getStoredTheme().mode);
  const save = useMutation({
    mutationFn: (mode: ThemeMode) => themesApi.updateActive({ mode }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: themeKeys.active }),
  });

  const setMode = (mode: ThemeMode) => {
    // The colors of an unsaved theme were made for the other mode.
    themeDraftStore.clear();
    if (active) {
      queryClient.setQueryData<ActiveThemes>(themeKeys.active, { ...active, mode });
      save.mutate(mode);
    } else {
      setLocalMode(mode);
      applyTheme(mode, null);
    }
  };

  return { mode: active?.mode ?? localMode, setMode };
};
