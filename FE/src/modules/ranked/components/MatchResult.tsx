import type { CSSProperties } from 'react';
import { Coins, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useCountUp } from '../hooks/use-count-up';
import { useJoinMatch, useRematch } from '../hooks/use-match';
import type { MatchPlayerView, MatchResult as Result, PublicMatch, RematchInvite, UnratedReason } from '../types/ranked.types';
import { PlayerCard } from './PlayerCard';

const HEADINGS: Record<Result, string> = { win: 'You win', loss: 'You lose', draw: 'Draw', forfeit: 'You forfeited' };

const UNRATED: Record<UnratedReason, string> = {
  'not-started': 'the race never started.',
  flagged: 'a player went over 200 WPM.',
  'pair-limit': 'you already played 3 rated matches with this player today.',
};

/** +20, −20 (a real minus sign) or ±0. */
const formatChange = (change: number) => (change > 0 ? `+${change}` : change < 0 ? `−${-change}` : '±0');

const ratingLine = (player: MatchPlayerView) =>
  player.ratingAfter !== undefined && player.ratingBefore !== undefined
    ? `Rating ${player.ratingAfter} (${formatChange(player.ratingAfter - player.ratingBefore)})`
    : undefined;

// 18 square sparks thrown out of the heading of a win, two sizes and two colors, each on its own angle.
const SPARKS = Array.from({ length: 18 }, (_, index) => {
  const angle = (index / 18) * Math.PI * 2;
  const distance = index % 2 ? 150 : 220;
  return {
    style: {
      '--dx': `${Math.round(Math.cos(angle) * distance)}px`,
      '--dy': `${Math.round(Math.sin(angle) * distance * 0.6)}px`,
      '--turn': `${index % 3 ? 180 : -270}deg`,
      animationDelay: `${120 + (index % 4) * 40}ms`,
    } as CSSProperties,
    className: cn(index % 3 ? 'size-2' : 'size-3', index % 2 ? 'bg-primary' : 'bg-foreground'),
  };
});

const Sparks = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0">
    {SPARKS.map((spark, index) => (
      <span key={index} className={cn('duel-spark absolute left-1/2 top-1/2', spark.className)} style={spark.style} />
    ))}
  </div>
);

/** The own rating after the match: the number counts from the old rating to the new one, with the change beside it. */
const RatingReward = ({ before, after }: { before: number; after: number }) => {
  const shown = useCountUp(after, before, { delay: 500 });
  const Icon = after < before ? TrendingDown : TrendingUp;
  return (
    <div className="duel-rise flex items-center gap-4 border bg-card/60 px-5 py-4 backdrop-blur-sm [animation-delay:300ms]">
      <Icon className="size-8 shrink-0" aria-hidden="true" />
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground">Rating</span>
        <span aria-hidden="true" className="text-4xl font-black leading-none tabular-nums">
          {shown}
        </span>
      </div>
      <span aria-hidden="true" className="ml-auto text-2xl font-bold tabular-nums">
        {formatChange(after - before)}
      </span>
      <span className="sr-only">
        Rating {after} ({formatChange(after - before)})
      </span>
    </div>
  );
};

/** The own coins of the match, counting up from 0. */
const CoinReward = ({ coins }: { coins: number }) => {
  const shown = useCountUp(coins, 0, { delay: 650 });
  return (
    <div className="duel-rise flex items-center gap-4 border bg-card/60 px-5 py-4 backdrop-blur-sm [animation-delay:450ms]">
      <Coins className="size-8 shrink-0" aria-hidden="true" />
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground">Coins</span>
        <span aria-hidden="true" className="text-4xl font-black leading-none tabular-nums">
          +{shown}
        </span>
      </div>
      <span className="sr-only">+{coins} coins</span>
    </div>
  );
};

interface MatchResultProps {
  match: PublicMatch;
  myId?: string;
  /** A rematch the opponent asked for. */
  invite?: RematchInvite;
  /** Go to another room (the rematch). */
  onEnter: (code: string) => void;
  onLeave: () => void;
}

/**
 * The end of a duel: who won (a win throws sparks), the own rating and coins counting up, each player in the win or
 * lose pose with their numbers, Rematch and Back to lobby.
 */
export const MatchResult = ({ match, myId, invite, onEnter, onLeave }: MatchResultProps) => {
  const rematch = useRematch();
  const join = useJoinMatch();
  const me = match.players.find((player) => player.userId === myId);
  const ordered = [me, ...match.players.filter((player) => player !== me)].filter((player) => player !== undefined);
  const won = me?.result === 'win';
  const rated = me?.ratingBefore !== undefined && me.ratingAfter !== undefined;

  return (
    <div className="mx-auto my-auto flex w-full max-w-3xl flex-col items-center gap-6 text-primary">
      <div className="relative flex w-full justify-center py-4">
        {won && <Sparks />}
        <h2 className={cn('relative text-5xl font-black uppercase sm:text-6xl', won ? 'duel-slam' : 'duel-rise', !won && 'text-foreground')}>
          {me?.result ? HEADINGS[me.result] : 'Match over'}
        </h2>
      </div>
      {invite && (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 border border-primary/50 bg-primary/10 px-4 py-2">
          <span>{invite.from} wants a rematch</span>
          <Button size="sm" disabled={join.isPending} onClick={() => join.mutate(invite.code, { onSuccess: (room) => onEnter(room.code) })}>
            Join
          </Button>
        </div>
      )}
      {(rated || me?.coins !== undefined) && (
        <div className="grid w-full gap-3 sm:grid-cols-2">
          {rated && <RatingReward before={me.ratingBefore!} after={me.ratingAfter!} />}
          {/* Only the own coins: what the other player earns is theirs. */}
          {me?.coins !== undefined && <CoinReward coins={me.coins} />}
        </div>
      )}
      <div className="grid w-full gap-4 sm:grid-cols-2">
        {ordered.map((player, index) => (
          <PlayerCard
            key={player.userId}
            player={player}
            isMe={player === me}
            highlight={player.result === 'win'}
            pose={player.result === 'win' ? 'win' : player.result === 'draw' ? 'idle' : 'lose'}
            className="duel-rise"
            // The cards come in after the rewards.
            style={{ animationDelay: `${600 + index * 120}ms` }}
          >
            <p className="text-sm text-muted-foreground tabular-nums">{Math.round(player.wpm)} WPM</p>
            <p className="text-sm text-muted-foreground tabular-nums">{Math.round(player.accuracy * 100)}% accuracy</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {player.correctWords}/{match.wordCount} correct words
            </p>
            {/* The own rating is the reward above. */}
            {player !== me && ratingLine(player) && <p className="font-semibold tabular-nums">{ratingLine(player)}</p>}
          </PlayerCard>
        ))}
      </div>
      {match.unratedReason && <p className="text-sm text-muted-foreground">Not rated: {UNRATED[match.unratedReason]}</p>}
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
