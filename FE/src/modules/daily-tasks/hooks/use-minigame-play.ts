import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { profileKeys } from '@/modules/profile/hooks/use-profile';
import { minigamePlaysApi } from '../api/daily-tasks.api';
import type { MinigameKind } from '../types/daily-task.types';

/**
 * Tells the server when a minigame starts and ends, so it counts for the daily task `minigames` (SCRUM-300). `begin` opens a
 * play and keeps the id it will get; `finish` closes that play once it has the id (a second `finish`, or one without a
 * `begin`, does nothing) and asks for the daily tasks again. Counting never gets in a game's way: both calls swallow their
 * errors, with no toast, and a failed start just means the game is not counted.
 */
export const useMinigamePlay = (game: MinigameKind) => {
  const queryClient = useQueryClient();
  // `onError` is given so the app's default error toast stays quiet: a game that is not counted is no news to the player.
  const { mutateAsync: startPlay } = useMutation({ mutationFn: () => minigamePlaysApi.start(game), onError: () => undefined });
  const { mutateAsync: finishPlay } = useMutation({
    mutationFn: (id: string) => minigamePlaysApi.finish(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.dailyTasks() }),
    onError: () => undefined,
  });
  /** The id of the play now open, as a promise (`null` when the start failed). */
  const open = useRef<Promise<string | null> | null>(null);

  const begin = useCallback(() => {
    open.current = startPlay().then(
      ({ id }) => id,
      () => null,
    );
  }, [startPlay]);

  const finish = useCallback(() => {
    const play = open.current;
    open.current = null;
    if (!play) return;
    void play.then((id) => (id ? finishPlay(id) : undefined)).catch(() => undefined);
  }, [finishPlay]);

  return { begin, finish };
};
