import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSetCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { avatarApi } from '../api/avatar.api';

/** Cache keys. */
export const avatarKeys = {
  catalog: ['avatar', 'catalog'] as const,
};

/** Every item with how it is unlocked and whether it is owned, the look worn and the coins. */
export const useAvatarCatalog = () => useQuery({ queryKey: avatarKeys.catalog, queryFn: avatarApi.catalog });

// No `onError`: the shared query client toasts the backend message (e.g. "Not enough coins").
export const useBuyItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: avatarApi.buy,
    onSuccess: (catalog) => {
      queryClient.setQueryData(avatarKeys.catalog, catalog);
      toast.success('Item bought.');
    },
  });
};

// No `onError`: the shared query client toasts the backend message.
export const useUpdateAvatar = () => {
  const queryClient = useQueryClient();
  const setCurrentUser = useSetCurrentUser();
  return useMutation({
    mutationFn: avatarApi.update,
    onSuccess: (user) => {
      // The header and the profile read the look from the current user.
      setCurrentUser(user);
      toast.success('Outfit saved.');
      return queryClient.invalidateQueries({ queryKey: avatarKeys.catalog });
    },
  });
};
