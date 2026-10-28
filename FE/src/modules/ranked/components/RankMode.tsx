import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Button } from '@/shared/components/ui/button';
import { useMatch } from '../hooks/use-match';
import { RaceView } from './RaceView';
import { RankLobby } from './RankLobby';
import { RoomLobby } from './RoomLobby';

/**
 * The Rank tab of the Typing page (`/typing?mode=rank`). The room code lives in the URL (`&room=CODE`), so a reload comes
 * back to the same room and its stream reconnects. Without a room: create or join one; then the room as its status says.
 */
export const RankMode = () => {
  const [params, setParams] = useSearchParams();
  const code = params.get('room') ?? undefined;
  const { data: me } = useCurrentUser();
  const { match, isLoading, error, gone } = useMatch(code);
  const roomGone = gone || (error as { response?: { status?: number } } | null)?.response?.status === 404;

  const setRoom = (next?: string) =>
    setParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set('mode', 'rank');
      if (next) updated.set('room', next);
      else updated.delete('room');
      return updated;
    });

  // An old link or a room that closed while away: back to the lobby.
  useEffect(() => {
    if (code && roomGone) setRoom(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, roomGone]);

  if (!code || roomGone) return <RankLobby onEnter={setRoom} />;
  if (!match) {
    return (
      <div className="mx-auto my-auto w-full max-w-3xl">
        {error ? <ErrorState error={error} onRetry={() => setRoom(code)} /> : isLoading && <LoadingState rows={2} />}
      </div>
    );
  }

  if (match.status === 'waiting') return <RoomLobby match={match} myId={me?._id} onLeft={() => setRoom(undefined)} />;
  if (match.status === 'cancelled') {
    return (
      <div className="mx-auto my-auto flex flex-col items-center gap-4 text-primary">
        <p className="text-lg">This room was closed.</p>
        <Button onClick={() => setRoom(undefined)}>Back to lobby</Button>
      </div>
    );
  }
  if (match.status === 'countdown' || match.status === 'running') return <RaceView match={match} myId={me?._id} />;
  return <p className="mx-auto my-auto text-primary">Match over</p>;
};
