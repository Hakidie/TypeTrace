import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { ErrorState } from '@/shared/components/error-state';
import { Button } from '@/shared/components/ui/button';
import { useMatch } from '../hooks/use-match';
import { LoadingRing } from './LoadingRing';
import { MatchNotices } from './MatchNotices';
import { MatchResult } from './MatchResult';
import { RaceView } from './RaceView';
import { RainDuelView } from './RainDuelView';
import { RankLobby } from './RankLobby';
import { RoomLobby } from './RoomLobby';

// The last room of this tab (sessionStorage: per tab, gone when it closes). Storage can be blocked; then it is not remembered.
const LAST_ROOM = 'ranked.room';
const lastRoom = () => {
  try {
    return sessionStorage.getItem(LAST_ROOM) ?? undefined;
  } catch {
    return undefined;
  }
};
const rememberRoom = (code: string) => {
  try {
    sessionStorage.setItem(LAST_ROOM, code);
  } catch {
    // not remembered
  }
};
const forgetRoom = () => {
  try {
    sessionStorage.removeItem(LAST_ROOM);
  } catch {
    // nothing to forget
  }
};

/**
 * The Rank tab of the Typing page (`/typing?mode=rank`). The room code lives in the URL (`&room=CODE`), so a reload comes
 * back to the same room and its stream reconnects. Without a room: create or join one; then the room as its status says.
 */
export const RankMode = () => {
  const [params, setParams] = useSearchParams();
  const code = params.get('room') ?? undefined;
  const { data: me } = useCurrentUser();
  const { match, isLoading, error, gone, invite, refetch, connected, away, resume } = useMatch(code);
  // 400: not a room code at all (an edited link); 404: no such room for this user.
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  const roomGone = gone || status === 400 || status === 404;

  const setRoom = (next?: string) => {
    if (!next) forgetRoom();
    setParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set('mode', 'rank');
      if (next) updated.set('room', next);
      else updated.delete('room');
      return updated;
    });
  };

  // The room survives a look at the other tabs: remember it, and come back to it when the Rank tab opens without one.
  useEffect(() => {
    if (code) rememberRoom(code);
  }, [code]);
  useEffect(() => {
    const last = lastRoom();
    if (!code && last) setRoom(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An old link or a room that closed while away: back to the lobby.
  useEffect(() => {
    if (code && roomGone) setRoom(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, roomGone]);

  if (!code || roomGone) return <RankLobby onEnter={setRoom} />;
  if (!match) {
    return (
      <div className="mx-auto my-auto w-full max-w-3xl">
        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : isLoading && <LoadingRing label="Opening the room…" />}
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
  if (match.status === 'countdown' || match.status === 'running') {
    return (
      <div className="flex flex-1 flex-col gap-2">
        <MatchNotices match={match} myId={me?._id} connected={connected} away={away} />
        {match.kind === 'rain' ? <RainDuelView match={match} myId={me?._id} /> : <RaceView match={match} myId={me?._id} resume={resume} />}
      </div>
    );
  }
  return <MatchResult match={match} myId={me?._id} invite={invite} onEnter={setRoom} onLeave={() => setRoom(undefined)} />;
};
