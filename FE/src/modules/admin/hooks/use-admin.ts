import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { themeKeys } from '@/modules/settings/hooks/use-themes';
import type { ThemeInput } from '@/modules/settings/types/theme.types';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import { adminApi } from '../api/admin.api';
import type { AdminThemeInput, AdminThemeListParams, AdminUpdateUserInput, AdminUserListParams, UserStatus } from '../types/admin.types';

/** Cache keys. Invalidating `adminKeys.all` refreshes every admin query. */
export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  users: (params: AdminUserListParams) => [...adminKeys.all, 'users', params] as const,
  themes: (params: AdminThemeListParams) => [...adminKeys.all, 'themes', params] as const,
};

export const useAdminStats = () => useQuery({ queryKey: adminKeys.stats(), queryFn: adminApi.stats });

/** Keeps the previous page on screen while the next one loads. */
export const useAdminUsers = (params: AdminUserListParams) =>
  useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => adminApi.listUsers(params),
    placeholderData: keepPreviousData,
  });

export const useAdminThemes = (params: AdminThemeListParams) =>
  useQuery({
    queryKey: adminKeys.themes(params),
    queryFn: () => adminApi.listThemes(params),
    placeholderData: keepPreviousData,
  });

// Mutations: no `onError` — the shared query client toasts the backend message.

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminUpdateUserInput }) => adminApi.updateUser(id, input),
    onSuccess: () => {
      toast.success('User updated.');
      // The admin may have edited their own account.
      void queryClient.invalidateQueries({ queryKey: currentUserKey });
      return queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
};

export const useSetUserStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => adminApi.setUserStatus(id, status),
    onSuccess: (_user, { status }) => {
      toast.success(status === 'locked' ? 'User disabled.' : 'User enabled.');
      return queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
};

export const useDeleteUsers = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      ids.length === 1 ? adminApi.deleteUser(ids[0]).then(() => ({ deleted: 1 })) : adminApi.bulkDeleteUsers(ids),
    onSuccess: ({ deleted }) => {
      toast.success(deleted === 1 ? 'User deleted.' : `${deleted} users deleted.`);
      return queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
};

/** TypeTrace's themes are offered to every learner, so the lists in Settings are refreshed too. */
const refreshThemes = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: adminKeys.all }),
    queryClient.invalidateQueries({ queryKey: themeKeys.all }),
  ]);

export const useCreateAdminTheme = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminThemeInput) => adminApi.createTheme(input),
    onSuccess: () => {
      toast.success('Theme created.');
      return refreshThemes(queryClient);
    },
  });
};

export const useUpdateAdminTheme = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ThemeInput> }) => adminApi.updateTheme(id, input),
    onSuccess: () => {
      toast.success('Theme updated.');
      return refreshThemes(queryClient);
    },
  });
};

export const useDeleteAdminTheme = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteTheme(id),
    onSuccess: () => {
      toast.success('Theme deleted.');
      return refreshThemes(queryClient);
    },
  });
};
