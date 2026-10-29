import { Heart } from 'lucide-react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { RainStage } from '@/modules/rain/components/RainStage';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { practiceReducer, PRACTICE_PACE, startPractice, type PracticeSide, type PracticeState } from '../lib/practice-duel';
import type { CoachStats } from '../types/tutorial.types';
import { Ping } from './Ping';

const TICK_MS = 100;

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const Lives = ({ who, lives }: { who: string; lives: number }) => (
  <div role="img" aria-label={`${who}: ${lives} ${lives === 1 ? 'life' : 'lives'} left`} className="flex gap-0.5 text-primary">
    {Array.from({ length: PRACTICE_PACE.lives }, (_, index) => (
      <Heart key={index} aria-hidden="true" className={cn('size-4', index < lives ? 'fill-current' : 'opacity-40')} />
    ))}
  </div>
);

const shuffled = (words: string[]) => [...words].sort(() => Math.random() - 0.5);

/** Ping's move on his side: typing while it rains, sad right after losing a life, happy right after a throw at me. */
const pingMove = (state: PracticeState) => {
  const recent = (at?: number) => at !== undefined && state.elapsed - at < 900;
  if (state.lastLand?.side === 'bot' && recent(state.lastLand.at)) return 'sad';
  if (state.lastThrow?.to === 'me' && recent(state.lastThrow.at)) return 'happy';
  return 'typing';
};

/** The numbers Ping's tip is written from. */
const statsOf = (state: PracticeState, me: PracticeSide): CoachStats => ({
  result: state.result ?? 'draw',
  hits: me.hits,
  thrown: me.thrown,
  livesLeft: Math.max(0, me.lives),
  seconds: Math.round(state.elapsed / 1000),
  missedWords: [...new Set(state.missed.map((word) => word.toLowerCase()))].slice(-10),
});

interface PracticeDuelProps {
  words: string[];
  onDone: (stats: CoachStats) => void;
  onSkip: () => void;
}

/**
 * The practice rain duel against Ping-bot, in the layout of the ranked rain duel: my field large with the box under it,
 * Ping's small beside it (a strip above it on a phone), always tagged as unrated. It runs only here (`practice-duel.ts`).
 */
export const PracticeDuel = ({ words, onDone, onSkip }: PracticeDuelProps) => {
  const [state, dispatch] = useReducer(practiceReducer, words, (list) => startPractice(shuffled(list), Math.random));
  const [box, setBox] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const { data: me } = useCurrentUser();
  const over = state.result !== null;

  useEffect(() => {
    input.current?.focus();
    const timer = setInterval(() => dispatch({ type: 'tick', dt: TICK_MS, rand: Math.random }), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const doneOnce = useRef(false);
  useEffect(() => {
    if (!over || doneOnce.current) return;
    doneOnce.current = true;
    onDone(statsOf(state, state.me));
  }, [over, state, onDone]);

  const send = (word: string) => {
    if (word) dispatch({ type: 'type', text: word, rand: Math.random });
  };
  // A word goes on space or Enter; what is typed after the space starts the next word.
  const onChange = (value: string) => {
    const gap = value.search(/\s/);
    if (gap < 0) {
      setBox(value);
      return dispatch({ type: 'input', text: value });
    }
    send(value.slice(0, gap).trim());
    const rest = value.slice(gap).trimStart();
    setBox(rest);
    dispatch({ type: 'input', text: rest });
  };

  const thrownAtPing = state.lastThrow?.to === 'bot' && state.elapsed - state.lastThrow.at < 1500;
  const thrownAtMe = state.lastThrow?.to === 'me' ? state.lastThrow : undefined;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="border border-primary/50 px-2 py-0.5 text-primary">Đấu tập · không tính điểm</span>
        <span className="flex items-center gap-3 text-muted-foreground">
          Bronze
          <span aria-label="Time left" className="font-semibold tabular-nums text-foreground">
            {clock(PRACTICE_PACE.durationMs - state.elapsed)}
          </span>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Bỏ qua
          </Button>
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        <section aria-label="Your field" className="order-2 flex min-w-0 flex-col gap-2 lg:order-1">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex shrink-0 items-center gap-2 font-semibold text-foreground">
              You <Lives who="You" lives={state.me.lives} />
            </span>
            <p role="status" className="min-w-0 flex-1 truncate text-center">
              {thrownAtMe && (
                <span key={thrownAtMe.at} className="rain-banner bg-primary/80 px-2 py-0.5 font-semibold text-primary-foreground">
                  Ping threw: {thrownAtMe.text}
                </span>
              )}
            </p>
            <span className="shrink-0 tabular-nums">{state.me.hits} words</span>
          </div>
          <RainStage drops={state.me.drops} avatar={me?.avatar ?? DEFAULT_AVATAR} phase="playing" paused={over} />
        </section>
        <section aria-label="Ping's field" className="relative order-1 flex min-w-0 flex-col gap-2 lg:order-2">
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 font-semibold text-foreground">
              Ping <Lives who="Ping" lives={state.bot.lives} />
            </span>
            <span className="tabular-nums">{state.bot.hits} words</span>
          </div>
          <RainStage
            drops={state.bot.drops}
            avatar={DEFAULT_AVATAR}
            character={<Ping move={pingMove(state)} />}
            phase="playing"
            paused={over}
            compact
            className="h-28 lg:h-[60vh] lg:min-h-80"
          />
          {thrownAtPing && <p className="absolute inset-x-2 top-8 z-10 border bg-background/85 px-2 py-1 text-xs backdrop-blur-sm">Ối, chữ bay tới kìa!</p>}
        </section>
      </div>
      <input
        ref={input}
        aria-label="Type a falling word"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={box}
        disabled={over}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
          send(box.trim());
          setBox('');
          dispatch({ type: 'input', text: '' });
        }}
        className="h-14 w-full border border-foreground/15 bg-background/60 px-4 text-center font-mono text-2xl backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
};
