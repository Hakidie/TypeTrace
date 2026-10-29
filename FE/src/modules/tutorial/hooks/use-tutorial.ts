import { useMutation, useQuery } from '@tanstack/react-query';
import { useSetCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { tutorialApi, type TutorialUpdate } from '../api/tutorial.api';
import type { CoachStats } from '../types/tutorial.types';

// The tutorial state is part of the signed-in user (`useCurrentUser().data?.tutorial`): each change answers the user,
// which replaces the cached one.

/** Right after sign-up: starts the tour. */
export const useStartTutorial = () => {
  const setUser = useSetCurrentUser();
  return useMutation({ mutationFn: () => tutorialApi.start(), onSuccess: setUser });
};

/** A mode learned or skipped, or the tour ended. */
export const useUpdateTutorial = () => {
  const setUser = useSetCurrentUser();
  return useMutation({ mutationFn: (body: TutorialUpdate) => tutorialApi.update(body), onSuccess: setUser });
};

/** "Xem lại hướng dẫn" in Settings. */
export const useResetTutorial = () => {
  const setUser = useSetCurrentUser();
  return useMutation({ mutationFn: () => tutorialApi.reset(), onSuccess: setUser });
};

/**
 * Ping's tip after a practice duel. A read (the server keeps nothing), asked once per match: the backend already answers a
 * written tip when the AI cannot, and a failed request shows the page's own tip.
 */
export const useCoachTip = (stats: CoachStats) =>
  useQuery({ queryKey: ['tutorial', 'coach', stats] as const, queryFn: () => tutorialApi.coach(stats), staleTime: Infinity, retry: false });
