import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { Coins, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useCountUp } from '../hooks/use-count-up';
import { useJoinMatch, useRematch } from '../hooks/use-match';
import type { MatchPlayerView, PublicMatch, RematchInvite } from '../types/ranked.types';
import { PlayerCard } from './PlayerCard';

const formatChange = (change: number) => (change > 0 ? `+${change}` : change < 0 ? `−${-change}` : '±0');

const ratingLine = (player: MatchPlayerView, t: TFunction<'ranked'>) =>
  player.ratingAfter !== undefined && player.ratingBefore !== undefined
    ? t('result.ratingLine', { after: player.ratingAfter, change: formatChange(player.ratingAfter - player.ratingBefore) })
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

/** The own rating after the match: the number counts from the old rating to the new one, with the change on its right. */
const RatingReward = ({ before, after }: { before: number; after: number }) => {
  const { t } = useTranslation('ranked');
  const shown = useCountUp(after, before, { delay: 500 });
  const Icon = after < before ? TrendingDown : TrendingUp;
  return (
    <div className="duel-rise flex items-center gap-4 border bg-card/60 px-5 py-4 backdrop-blur-sm [animation-delay:300ms]">
      <Icon className="size-9 shrink-0" aria-hidden="true" />
      <span className="text-4xl font-semibold leading-none">{t('result.rating')}</span>
      <div aria-hidden="true" className="ml-auto flex items-start gap-3 text-right">
        <span className="text-4xl font-black leading-none tabular-nums">{shown}</span>
        <span className="text-2xl font-bold tabular-nums">{formatChange(after - before)}</span>
      </div>
      <span className="sr-only">
        {t('result.ratingSr', { after, change: formatChange(after - before) })}
      </span>
    </div>
  );
};

/** The own coins of the match, counting up from 0. */
const CoinReward = ({ coins }: { coins: number }) => {
  const { t } = useTranslation('ranked');
  const shown = useCountUp(coins, 0, { delay: 650 });
  return (
    <div className="duel-rise flex items-center gap-4 border bg-card/60 px-5 py-4 backdrop-blur-sm [animation-delay:450ms]">
      <Coins className="size-9 shrink-0" aria-hidden="true" />
      <span className="text-4xl font-semibold leading-none">{t('result.coins')}</span>
      <span aria-hidden="true" className="ml-auto text-right text-4xl font-black leading-none tabular-nums">
        +{shown}
      </span>
      <span className="sr-only">{t('result.coinsSr', { count: coins })}</span>
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
 * The end of a duel, laid out like the lobby and the waiting room (`max-w-7xl`, from the top, 2rem under the tab bar and
 * between blocks): who won, in the red of the Season title (a win throws sparks), the own rating and coins counting up, each player in the win or
 * lose pose with their numbers, Rematch and Back to lobby.
 */
export const MatchResult = ({ match, myId, invite, onEnter, onLeave }: MatchResultProps) => {
  const { t } = useTranslation('ranked');
  const rematch = useRematch();
  const join = useJoinMatch();
  const me = match.players.find((player) => player.userId === myId);
  const ordered = [me, ...match.players.filter((player) => player !== me)].filter((player) => player !== undefined);
  const won = me?.result === 'win';
  const rated = me?.ratingBefore !== undefined && me.ratingAfter !== undefined;

  // A rain duel that ended on lives (not on the time): K.O. slams in first, then the result.
  const knockedOut = match.kind === 'rain' && match.players.some((player) => player.lives === 0);
  // Won because the other player left or stayed away (DNF): say so, the numbers alone would not.
  const quitter = won ? match.players.find((player) => player !== me && player.result === 'forfeit') : undefined;

  return (
    <div className="mx-auto -mt-16 flex w-full max-w-7xl flex-col items-center gap-8 text-primary">
      {knockedOut && <p className="duel-slam text-7xl font-black tracking-widest sm:text-8xl">{t('result.ko')}</p>}
      <div className="relative flex w-full justify-center py-4">
        {won && <Sparks />}
        <h2 className={cn('relative text-5xl font-black uppercase sm:text-6xl', won ? 'duel-slam' : 'duel-rise')}>
          {me?.result ? t(`result.${me.result}`) : t('result.over')}
        </h2>
      </div>
      {quitter && <p className="-mt-4 text-lg">{t('result.quitter', { name: quitter.displayName })}</p>}
      {invite && (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 border border-primary/50 bg-primary/10 px-4 py-2">
          <span>{t('result.rematchWanted', { name: invite.from })}</span>
          <Button size="sm" disabled={join.isPending} onClick={() => join.mutate(invite.code, { onSuccess: (room) => onEnter(room.code) })}>
            {t('result.joinRematch')}
          </Button>
        </div>
      )}
      {(rated || me?.coins !== undefined) && (
        <div className="grid w-full gap-4 sm:grid-cols-2 sm:gap-x-8">
          {rated && <RatingReward before={me.ratingBefore!} after={me.ratingAfter!} />}
          {/* Only the own coins: what the other player earns is theirs. */}
          {me?.coins !== undefined && <CoinReward coins={me.coins} />}
        </div>
      )}
      <div className="grid w-full gap-4 sm:grid-cols-2 sm:gap-x-8">
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
            {match.kind === 'rain' ? (
              <>
                <p className="text-sm text-muted-foreground tabular-nums">{t('result.wordsTyped', { count: player.hits ?? 0 })}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {t('result.lives', { count: player.lives ?? 0 })}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground tabular-nums">{Math.round(player.wpm)} WPM</p>
                <p className="text-sm text-muted-foreground tabular-nums">{t('result.accuracy', { count: Math.round(player.accuracy * 100) })}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {t('result.correctWords', { correct: player.correctWords, total: match.wordCount })}
                </p>
              </>
            )}
            {player.result === 'forfeit' && <p className="font-semibold tracking-widest">{t('result.dnf')}</p>}
            {/* The own rating is the reward above. */}
            {player !== me && ratingLine(player, t) && <p className="font-semibold tabular-nums">{ratingLine(player, t)}</p>}
          </PlayerCard>
        ))}
      </div>
      {match.unratedReason && <p className="text-sm text-muted-foreground">{t('result.notRated', { reason: t(`result.unrated.${match.unratedReason}`) })}</p>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onLeave}>
          {t('lobby.back')}
        </Button>
        <Button disabled={rematch.isPending} onClick={() => rematch.mutate(match.code, { onSuccess: (room) => onEnter(room.code) })}>
          {t('result.rematch')}
        </Button>
      </div>
    </div>
  );
};
