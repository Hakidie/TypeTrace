import { Copy, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useLeaveMatch, useReady } from '../hooks/use-match';
import type { MatchPlayerView, PublicMatch } from '../types/ranked.types';
import { PlayerCard } from './PlayerCard';

interface RoomLobbyProps {
  match: PublicMatch;
  myId?: string;
  onLeft: () => void;
}

/**
 * The waiting room: the code to share in a `Panel`, the two seats face to face, Ready (once the opponent is in) and Leave.
 * Laid out like the Rank lobby: as wide as the page, from the top, 4rem between the blocks. The Typing page keeps 6rem under
 * the tab bar in Rank: `-mt-8` makes it 4rem here too.
 */
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
    <div className="mx-auto -mt-8 flex w-full max-w-7xl flex-col items-center gap-16">
      <div className="w-full">
        <Panel bare className="flex flex-col items-center gap-2 text-primary">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Room code</p>
          <div className="flex items-center gap-2 border border-dashed border-primary/50 bg-card/60 py-2 pl-5 pr-2 backdrop-blur-sm">
            <span className="text-4xl font-bold tracking-[0.3em] tabular-nums">{match.code}</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Copy code" onClick={copy}>
                    <Copy className="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy code</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-sm text-muted-foreground">{match.passageTitle}</p>
        </Panel>
      </div>
      <div className="w-full">
        <Panel bare>
          <div className="grid w-full items-stretch gap-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-x-12">
            {seat(me, 0)}
            <span aria-hidden="true" className="duel-pop self-center text-center text-4xl font-black italic text-primary">
              VS
            </span>
            {seat(opponent, 1)}
          </div>
        </Panel>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <Button
          variant="outline"
          size="lg"
          className="min-w-44 border-primary/40 bg-transparent text-primary hover:border-primary hover:bg-primary hover:text-primary-foreground"
          disabled={leave.isPending}
          onClick={() => leave.mutate(match.code, { onSuccess: onLeft })}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Leave room
        </Button>
        {opponent && me && (
          <Button size="lg" className="min-w-44" disabled={ready.isPending} onClick={() => ready.mutate({ code: match.code, ready: !me.ready })}>
            {me.ready ? 'Not ready' : 'Ready'}
          </Button>
        )}
      </div>
    </div>
  );
};
