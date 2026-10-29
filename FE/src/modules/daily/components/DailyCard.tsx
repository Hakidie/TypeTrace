import { Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Lottie } from '@/shared/components/lottie';
import { cn } from '@/shared/lib/utils';
import { DAILY_TRIES, type DailyToday } from '../types/daily.types';

/** The glass card of the Daily tab (the red glass of the login and typing pages). */
export const dailyGlass = 'border border-primary/30 bg-destructive/10 backdrop-blur-md';

const untilNext = (endsAt: string) => {
  const minutes = Math.max(0, Math.floor((Date.parse(endsAt) - Date.now()) / 60_000));
  return `New one in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const Tile = ({ label, children }: { label: string; children: ReactNode }) => (
  <div aria-label={label} className="flex flex-col gap-1 bg-card/60 p-3">
    <span className="text-sm text-muted-foreground">{label}</span>
    {children}
  </div>
);

interface DailyCardProps {
  today: DailyToday;
  onStart: () => void;
  starting?: boolean;
}

/** Today's challenge: the passage, the tries left, the learner's best and rank, the streak (with its flame) and Start. */
export const DailyCard = ({ today, onStart, starting = false }: DailyCardProps) => {
  const nextTry = DAILY_TRIES - today.triesLeft + 1;
  return (
    <section aria-label="Daily challenge" className={cn('flex flex-col gap-4 p-5', dailyGlass)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted-foreground">
        <span>Daily challenge, {new Date(`${today.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        <span className="flex items-center gap-1">
          <Clock className="size-4" aria-hidden="true" />
          {untilNext(today.endsAt)}
        </span>
      </div>
      <h2 className="text-2xl font-black leading-tight text-foreground md:text-3xl">{today.passageTitle}</h2>
      <p className="border-l-2 border-primary pl-3 font-mono text-muted-foreground">{today.preview}…</p>

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Tries left">
          <span className="flex gap-1 pt-1" aria-hidden="true">
            {Array.from({ length: DAILY_TRIES }, (_, index) => (
              <span key={index} className={cn('h-1.5 w-6', index < today.triesLeft ? 'bg-primary' : 'bg-foreground/15')} />
            ))}
          </span>
          <span className="text-sm">
            {today.triesLeft} of {DAILY_TRIES}
          </span>
        </Tile>
        <Tile label="Your best">
          <span className="text-2xl font-black tabular-nums">{today.best ? today.best.score : '-'}</span>
          <span className="text-sm text-muted-foreground">{today.rank ? `#${today.rank} today` : 'No score yet'}</span>
        </Tile>
        <Tile label="Streak">
          <span className="flex items-center gap-1 text-2xl font-black tabular-nums text-primary">
            <Lottie name="fire-streak" loop play={today.streak > 0} className="size-8" />
            {today.streak}
          </span>
          <span className="text-sm text-muted-foreground">{today.streak === 1 ? 'day' : 'days'}</span>
        </Tile>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {today.triesLeft > 0 ? (
          <Button onClick={onStart} disabled={starting}>
            Start try {nextTry}
          </Button>
        ) : (
          <p className="font-semibold text-primary">Come back tomorrow</p>
        )}
        <span className="text-sm text-muted-foreground">{today.seconds} seconds, score = WPM × accuracy</span>
      </div>
    </section>
  );
};
