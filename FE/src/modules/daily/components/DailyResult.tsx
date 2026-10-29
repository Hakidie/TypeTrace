import { ArrowUp, Coins } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCountUp } from '@/modules/ranked/hooks/use-count-up';
import { Button } from '@/shared/components/ui/button';
import { Lottie } from '@/shared/components/lottie';
import { cn } from '@/shared/lib/utils';
import type { DailyToday, DailyTry } from '../types/daily.types';
import { dailyGlass } from './DailyCard';

/** The coins of a day are 20 plus 5 for each day of the streak before today (`coinsFor` in the backend). */
const BASE_COINS = 20;

/** ", #4 → #3" when the rank moved, ", #1 today" for the first score of the day, nothing when it stayed. */
const rankChange = (before: number | null, after: number | null) => {
  if (!after || before === after) return '';
  return before ? `, #${before} → #${after}` : `, #${after} today`;
};

const Tile = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
  <div aria-label={label} className={cn('relative flex flex-col gap-1 bg-card/60 p-3', className)}>
    <span className="text-sm text-muted-foreground">{label}</span>
    {children}
  </div>
);

const Score = ({ last }: { last: DailyTry }) => {
  const shown = useCountUp(last.score, 0, { delay: 200 });
  return (
    <div aria-label="Score" className="flex flex-col">
      <span className="text-sm text-muted-foreground">Score</span>
      <span aria-hidden="true" className="text-5xl font-black leading-none tabular-nums">
        {shown}
      </span>
      {/* The number counts up; screen readers read the result once. */}
      <span className="sr-only">{last.score}</span>
    </div>
  );
};

interface DailyResultProps {
  /** The card before the try and after it, to tell what changed (rank, streak). */
  before: DailyToday;
  after: DailyToday;
  onAgain: () => void;
  onBack: () => void;
  starting?: boolean;
}

/**
 * The result of a try: the score counting up, a new best with the change of rank (and confetti), the speed and accuracy,
 * the coins of the day (the coin icon pops), the streak, and another try while some are left.
 */
export const DailyResult = ({ before, after, onAgain, onBack, starting = false }: DailyResultProps) => {
  const last = after.lastTry;
  const grewStreak = after.streak > before.streak;
  return (
    <section aria-label="Your try" className={cn('relative flex flex-col gap-5 overflow-hidden p-5', dailyGlass)}>
      {last?.newBest && <Lottie name="confetti" className="absolute right-2 top-2 size-28" />}
      {!last || !last.counted ? (
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black text-primary">This try was too short to count</h2>
          <p className="text-muted-foreground">Type at least 20 words for a try to get a score.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <div className="flex flex-col gap-1">
            <Score last={last} />
            {last.newBest && (
              <span className="duel-rise flex items-center gap-1 text-sm font-semibold text-primary">
                <ArrowUp className="size-4" aria-hidden="true" />
                New best{rankChange(before.rank, after.rank)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="WPM">
              <span className="text-2xl font-black tabular-nums">{Math.round(last.wpm)}</span>
            </Tile>
            <Tile label="Accuracy">
              <span className="text-2xl font-black tabular-nums">{Math.round(last.accuracy)}%</span>
            </Tile>
            <Tile label="Coins">
              <span className="flex items-center gap-1 text-2xl font-black tabular-nums">
                {/* A coin animation would weigh 130 KB or more (they embed images): the icon pops with CSS instead. */}
                {last.coins > 0 && <Coins className="duel-pop size-6 text-primary [animation-delay:400ms]" aria-hidden="true" />}+{last.coins}
              </span>
              {last.coins > BASE_COINS && (
                <span className="text-sm text-muted-foreground">
                  {BASE_COINS} + streak {last.coins - BASE_COINS}
                </span>
              )}
            </Tile>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        {after.triesLeft > 0 ? (
          <Button onClick={onAgain} disabled={starting}>
            Try again ({after.triesLeft} left)
          </Button>
        ) : (
          <p className="font-semibold text-primary">Come back tomorrow</p>
        )}
        <Button variant="ghost" onClick={onBack}>
          Back to the challenge
        </Button>
        {grewStreak && (
          <span className="duel-pop flex items-center gap-1 text-sm font-semibold text-primary">
            <Lottie name="fire-streak" loop className="size-6" />
            Streak {after.streak} {after.streak === 1 ? 'day' : 'days'}
          </span>
        )}
      </div>
    </section>
  );
};
