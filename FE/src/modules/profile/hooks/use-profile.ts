import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentUserKey, useSetCurrentUser } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { profileApi } from '../api/profile.api';
import type { SessionListParams } from '../types/profile.types';

/** Cache keys. Invalidating `profileKeys.all` refreshes every profile query. */
export const profileKeys = {
  all: ['profile'] as const,
  activity: () => [...profileKeys.all, 'activity'] as const,
  sessions: (params: SessionListParams) => [...profileKeys.all, 'sessions', params] as const,
  streak: () => [...profileKeys.all, 'streak'] as const,
};

/**
 * The learner's typing activity: average speed and accuracy, counted sessions per day. Sessions are completed on the
 * typing page, so it is asked again each time the profile page opens (`staleTime: 0`).
 */
export const useTypingActivity = () =>
  useQuery({ queryKey: profileKeys.activity(), queryFn: profileApi.getActivity, staleTime: 0 });

/** One page of the learner's sessions; the previous page stays on screen while the next one loads. Asked again each time the page opens, like the activity. */
export const useSessions = (params: SessionListParams) =>
  useQuery({
    queryKey: profileKeys.sessions(params),
    queryFn: () => profileApi.getSessions(params),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

/** The learner's current and longest streak and today's daily mission; asked again each time the profile page opens, like the activity. */
export const useStreak = () => useQuery({ queryKey: profileKeys.streak(), queryFn: profileApi.getStreak, staleTime: 0 });

/**
 * Saves the learner's time zone (`PATCH /api/profile/settings`), keeps the user it returns and refreshes the profile
 * queries, whose days depend on the zone. A failure is silent (its own `onError`, so no error toast): the days stay in
 * the zone saved before. An answer that comes after the learner signed out (the request is sent on its own at page
 * load) is dropped, so it never shows their account to the next one.
 */
export const useSaveTimezone = () => {
  const queryClient = useQueryClient();
  const setCurrentUser = useSetCurrentUser();
  return useMutation({
    mutationFn: (timezone: string) => profileApi.updateSettings({ timezone }),
    onSuccess: async (user) => {
      if (queryClient.getQueryData<CurrentUser>(currentUserKey)?._id !== user._id) return;
      setCurrentUser(user);
      // Invalidating keeps the answer of a first fetch still on its way, asked in the old zone: cancel it first.
      await queryClient.cancelQueries({ queryKey: profileKeys.all });
      return queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
    onError: () => undefined,
  });
};
