import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tokenStore } from '@/modules/auth/store/token.store';
import { themesApi } from '../api/themes.api';
import type { ActiveThemes, Theme, ThemeInput } from '../types/theme.types';
import type { ThemeMode } from '@/shared/lib/theme';

/** Cache keys. Invalidating `themeKeys.all` refreshes the lists and the chosen themes. */
const allThemes = ['themes'] as const;
export const themeKeys = {
  all: allThemes,
  list: (isDark: boolean) => [...allThemes, 'list', isDark] as const,
  active: [...allThemes, 'active'] as const,
};

/** Published themes plus the user's own, for one mode. */
export const useThemes = (isDark: boolean) =>
  useQuery({ queryKey: themeKeys.list(isDark), queryFn: () => themesApi.list(isDark) });

/** The mode in use and the theme chosen for each mode. Only asked for when someone is signed in. */
export const useActiveThemes = () =>
  useQuery({ queryKey: themeKeys.active, queryFn: themesApi.getActive, enabled: Boolean(tokenStore.get()) });

// Mutations: no `onError`, the shared query client toasts the backend message.

export const useCreateTheme = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: themesApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: themeKeys.all }),
  });
};

export const useUpdateTheme = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ThemeInput> }) => themesApi.update(id, input),
    // The theme may be in use, so the chosen themes are asked again to show its new colors.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: themeKeys.all }),
  });
};

export const useDeleteTheme = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: themesApi.remove,
    onSuccess: () => {
      toast.success('Theme deleted.');
      // The server puts the built-in palette back in the mode that used it, so the chosen themes are asked again.
      return queryClient.invalidateQueries({ queryKey: themeKeys.all });
    },
  });
};

/** Chooses `theme` for `mode` (`null` = the built-in palette). The page changes at once; a failure puts the server's answer back. */
export const useChooseTheme = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mode, theme }: { mode: ThemeMode; theme: Theme | null }) =>
      themesApi.updateActive(mode === 'dark' ? { darkTheme: theme?._id ?? null } : { lightTheme: theme?._id ?? null }),
    onMutate: async ({ mode, theme }) => {
      await queryClient.cancelQueries({ queryKey: themeKeys.active });
      queryClient.setQueryData<ActiveThemes>(themeKeys.active, (active) => active && { ...active, [mode]: theme });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: themeKeys.active }),
  });
};
