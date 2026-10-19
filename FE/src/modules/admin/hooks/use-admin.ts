import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import { adminApi } from '../api/admin.api';
import type { AdminUpdateUserInput, AdminUserListParams, UserStatus } from '../types/admin.types';

/** Cache keys. Invalidating `adminKeys.all` refreshes every admin query. */
export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  users: (params: AdminUserListParams) => [...adminKeys.all, 'users', params] as const,
};

export const useAdminStats = () => useQuery({ queryKey: adminKeys.stats(), queryFn: adminApi.stats });

/** Keeps the previous page on screen while the next one loads. */
export const useAdminUsers = (params: AdminUserListParams) =>
  useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => adminApi.listUsers(params),
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
