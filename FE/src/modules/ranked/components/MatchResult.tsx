import { Button } from '@/shared/components/ui/button';
import { useJoinMatch, useRematch } from '../hooks/use-match';
import type { MatchResult as Result, PublicMatch, RematchInvite } from '../types/ranked.types';
import { PlayerCard } from './PlayerCard';

const HEADINGS: Record<Result, string> = { win: 'You win', loss: 'You lose', draw: 'Draw', forfeit: 'You forfeited' };

interface MatchResultProps {
  match: PublicMatch;
  myId?: string;
  /** A rematch the opponent asked for. */
  invite?: RematchInvite;
  /** Go to another room (the rematch). */
  onEnter: (code: string) => void;
  onLeave: () => void;
}

/** The end of a duel: who won, each player in the win or lose pose with their numbers, Rematch and Back to lobby. */
export const MatchResult = ({ match, myId, invite, onEnter, onLeave }: MatchResultProps) => {
  const rematch = useRematch();
  const join = useJoinMatch();
  const me = match.players.find((player) => player.userId === myId);
  const ordered = [me, ...match.players.filter((player) => player !== me)].filter((player) => player !== undefined);

  return (
    <div className="mx-auto my-auto flex w-full max-w-3xl flex-col items-center gap-6 text-primary">
      <h2 className="text-4xl font-black">{me?.result ? HEADINGS[me.result] : 'Match over'}</h2>
      {invite && (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 bg-primary/15 px-4 py-2">
          <span>{invite.from} wants a rematch</span>
          <Button size="sm" disabled={join.isPending} onClick={() => join.mutate(invite.code, { onSuccess: (room) => onEnter(room.code) })}>
            Join
          </Button>
        </div>
      )}
      <div className="grid w-full gap-4 sm:grid-cols-2">
        {ordered.map((player) => (
          <PlayerCard key={player.userId} player={player} isMe={player === me} pose={player.result === 'win' ? 'win' : player.result === 'draw' ? 'idle' : 'lose'}>
            <p className="text-sm text-muted-foreground">{Math.round(player.wpm)} WPM</p>
            <p className="text-sm text-muted-foreground">{Math.round(player.accuracy * 100)}% accuracy</p>
            <p className="text-sm text-muted-foreground">
              {player.correctWords}/{match.wordCount} correct words
            </p>
          </PlayerCard>
        ))}
      </div>
      {/* Elo comes in phase 5 of the ranked duel design. */}
      <p className="text-sm text-muted-foreground">Rating comes soon</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onLeave}>
          Back to lobby
        </Button>
        <Button disabled={rematch.isPending} onClick={() => rematch.mutate(match.code, { onSuccess: (room) => onEnter(room.code) })}>
          Rematch
        </Button>
      </div>
    </div>
  );
};
