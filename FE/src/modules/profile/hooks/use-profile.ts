import { useQuery } from '@tanstack/react-query';
import { profileApi } from '../api/profile.api';

/** Cache keys. Invalidating `profileKeys.all` refreshes every profile query. */
export const profileKeys = {
  all: ['profile'] as const,
  activity: () => [...profileKeys.all, 'activity'] as const,
};

/**
 * The learner's typing activity: average speed and accuracy, completed sessions per day. Sessions are completed on the
 * typing page, so it is asked again each time the profile page opens (`staleTime: 0`).
 */
export const useTypingActivity = () =>
  useQuery({ queryKey: profileKeys.activity(), queryFn: profileApi.getActivity, staleTime: 0 });
