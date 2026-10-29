import { useMutation } from '@tanstack/react-query';
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

/** Ping's tip after the practice duel. The backend answers a written tip when the AI cannot, so it does not toast. */
export const useCoachTip = () => useMutation({ mutationFn: (stats: CoachStats) => tutorialApi.coach(stats), onError: () => undefined });
