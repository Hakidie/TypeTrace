import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeDraftStore } from '@/modules/settings/store/theme-draft.store';
import { clearAppliedTheme } from '@/shared/lib/theme';
import { authApi } from '../api/auth.api';
import { tokenStore } from '../store/token.store';
import type { CurrentUser } from '../types/auth.types';

/** Cache key of the signed-in user. Invalidate it after any change to the user. */
export const currentUserKey = ['me'] as const;

/** The signed-in user, fetched once and shared by every component that asks. */
export const useCurrentUser = () =>
  useQuery({
    queryKey: currentUserKey,
    queryFn: authApi.getMe,
    enabled: Boolean(tokenStore.get()),
  });

/** Replaces the cached user with a fresh copy returned by a mutation. */
export const useSetCurrentUser = () => {
  const queryClient = useQueryClient();
  return (user: CurrentUser) => queryClient.setQueryData(currentUserKey, user);
};

/** Signs out: forgets the token and every cached response, then opens the login page. */
export const useLogout = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
    themeDraftStore.clear();
    clearAppliedTheme();
    navigate('/login', { replace: true });
  }, [queryClient, navigate]);
};
