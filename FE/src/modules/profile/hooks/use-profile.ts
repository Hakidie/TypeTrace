import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { profileApi } from '../api/profile.api';
import type { SessionListParams } from '../types/profile.types';

/** Cache keys. Invalidating `profileKeys.all` refreshes every profile query. */
export const profileKeys = {
  all: ['profile'] as const,
  activity: () => [...profileKeys.all, 'activity'] as const,
  sessions: (params: SessionListParams) => [...profileKeys.all, 'sessions', params] as const,
};

/**
 * The learner's typing activity: average speed and accuracy, completed sessions per day. Sessions are completed on the
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
