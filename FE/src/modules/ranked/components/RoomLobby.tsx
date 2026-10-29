import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { useLeaveMatch, useReady } from '../hooks/use-match';
import type { MatchPlayerView, PublicMatch } from '../types/ranked.types';
import { PlayerCard } from './PlayerCard';

interface RoomLobbyProps {
  match: PublicMatch;
  myId?: string;
  onLeft: () => void;
}

/** The waiting room: the code to share, the two seats face to face, Ready (once the opponent is in) and Leave. */
export const RoomLobby = ({ match, myId, onLeft }: RoomLobbyProps) => {
  const ready = useReady();
  const leave = useLeaveMatch();
  const me = match.players.find((player) => player.userId === myId);
  const opponent = match.players.find((player) => player.userId !== myId);

  const copy = () =>
    void navigator.clipboard?.writeText(match.code).then(
      () => toast.success('Code copied.'),
      () => toast.error('Could not copy the code.'),
    );

  const seat = (player: MatchPlayerView | undefined, index: number) => (
    <PlayerCard key={player?.userId ?? `empty-${index}`} player={player} isMe={player !== undefined && player === me} highlight={player?.ready}>
      {player && (
        <p className={player.ready ? 'text-sm font-semibold uppercase tracking-widest' : 'text-sm text-muted-foreground'}>
          {player.ready ? 'Ready' : 'Not ready'}
        </p>
      )}
    </PlayerCard>
  );

  return (
    <div className="mx-auto my-auto flex w-full max-w-3xl flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2 text-primary">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Room code</p>
        <div className="flex items-center gap-2 border border-dashed border-primary/50 bg-card/60 py-2 pl-5 pr-2 backdrop-blur-sm">
          <span className="text-4xl font-bold tracking-[0.3em] tabular-nums">{match.code}</span>
          <Button variant="ghost" size="sm" aria-label="Copy code" title="Copy code" onClick={copy}>
            <Copy className="size-5" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{match.passageTitle}</p>
      </div>
      <div className="grid w-full items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        {seat(me, 0)}
        <span aria-hidden="true" className="duel-pop text-center text-4xl font-black italic text-primary">
          VS
        </span>
        {seat(opponent, 1)}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={leave.isPending} onClick={() => leave.mutate(match.code, { onSuccess: onLeft })}>
          Leave room
        </Button>
        {opponent && me && (
          <Button disabled={ready.isPending} onClick={() => ready.mutate({ code: match.code, ready: !me.ready })}>
            {me.ready ? 'Not ready' : 'Ready'}
          </Button>
        )}
      </div>
    </div>
  );
};
