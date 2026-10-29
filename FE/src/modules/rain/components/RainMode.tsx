import { CloudRain, Heart, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useRainWords } from '../hooks/use-rain';
import { useRainGame } from '../hooks/use-rain-game';
import { LIVES, ROUND_MS, targetOf } from '../lib/rain-game';
import { RainStage } from './RainStage';

/** Fewer lanes on a phone, so the words are not squeezed. */
const laneCount = () => (window.matchMedia?.('(max-width: 639px)').matches ? 4 : 6);

const shuffled = (words: string[]) => [...words].sort(() => Math.random() - 0.5);

const clock = (ms: number) => {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** A glass card over the stage, for the start, pause and result screens. */
const Overlay = ({ children }: { children: ReactNode }) => (
  <div className="absolute inset-0 z-20 grid place-items-center bg-background/30 p-4">
    <div className="duel-pop flex w-full max-w-sm flex-col items-center gap-4 border border-primary/30 bg-card/85 p-6 text-center backdrop-blur-md">
      {children}
    </div>
  </div>
);

/**
 * The Rain tab of the Typing page (`?mode=rain`): a round of word rain. The words come from `GET /api/rain/words`, the
 * rules from `useRainGame`, the drawing from `RainStage`. Enter starts, Escape pauses, space or Enter sends the word in the box.
 */
export const RainMode = () => {
  const words = useRainWords();
  const { data: me } = useCurrentUser();
  const { state, paused, start, input, land, togglePause } = useRainGame();
  const box = useRef<HTMLInputElement>(null);
  const list = useMemo(() => words.data?.words ?? [], [words.data]);
  const playing = state.phase === 'playing';

  const begin = useCallback(() => start(shuffled(list), laneCount()), [start, list]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && playing) togglePause();
      // Only from the start screen: an Enter that clears the box at the end of a round must not start the next one.
      else if (event.key === 'Enter' && state.phase === 'ready' && list.length) begin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, state.phase, list.length, begin, togglePause]);

  useEffect(() => {
    if (playing && !paused) box.current?.focus();
  }, [playing, paused]);

  if (words.isLoading) return <LoadingState rows={2} />;
  if (words.isError) return <ErrorState error={words.error} onRetry={() => words.refetch()} />;
  if (!list.length) return <EmptyState icon={CloudRain} title="No words to rain yet" description="Ask an admin to add words to the word bank." />;

  const missing = state.input !== '' && !targetOf(state);
  const minutes = state.elapsed / 60_000;
  const wpm = minutes > 0 ? Math.round(state.typedChars / 5 / minutes) : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 py-4">
      <div className={cn('flex items-center justify-between gap-4 text-[1.125rem]', state.phase === 'ready' && 'invisible')}>
        <div role="img" aria-label={`${state.lives} lives left`} className="flex gap-1 text-primary">
          {Array.from({ length: LIVES }, (_, index) => (
            <Heart key={index} aria-hidden="true" className={cn('size-5', index < state.lives ? 'fill-current' : 'opacity-40')} />
          ))}
        </div>
        <div className="flex items-center gap-5 tabular-nums">
          <span className="text-muted-foreground">
            Score <span aria-label="Score" className="font-semibold text-primary">{state.score}</span>
          </span>
          <span aria-label="Time left" className="font-semibold">
            {clock(ROUND_MS - state.elapsed)}
          </span>
          <Button variant="ghost" size="sm" className="px-2" aria-label="Pause" aria-pressed={paused} disabled={!playing} onClick={togglePause}>
            {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
          </Button>
        </div>
      </div>

      <div className="relative">
        <RainStage
          drops={state.drops}
          avatar={me?.avatar ?? DEFAULT_AVATAR}
          phase={state.phase}
          targetId={targetOf(state)?.id}
          reaction={state.reaction}
          paused={paused || !playing}
          onLand={land}
        />
        {state.phase === 'ready' && (
          <Overlay>
            <h2 className="text-2xl font-black text-primary">Word rain</h2>
            <p className="text-muted-foreground">Type a falling word and press space before it reaches your head. Three misses end the round.</p>
            <Button onClick={begin}>Start</Button>
          </Overlay>
        )}
        {paused && (
          <Overlay>
            <h2 className="text-2xl font-black text-primary">Paused</h2>
            <Button onClick={togglePause}>Resume</Button>
          </Overlay>
        )}
        {(state.phase === 'won' || state.phase === 'lost') && (
          <Overlay>
            <h2 className="text-2xl font-black text-primary">{state.phase === 'won' ? 'You beat the rain' : 'The rain won'}</h2>
            <dl className="grid w-full grid-cols-2 gap-2">
              <div className="border border-foreground/10 p-3">
                <dt className="text-sm text-muted-foreground">Words</dt>
                <dd className="text-3xl font-black tabular-nums">{state.score}</dd>
              </div>
              <div className="border border-foreground/10 p-3">
                <dt className="text-sm text-muted-foreground">WPM</dt>
                <dd className="text-3xl font-black tabular-nums">{wpm}</dd>
              </div>
            </dl>
            <Button onClick={begin}>Play again</Button>
          </Overlay>
        )}
      </div>

      {playing && (
        <input
          ref={box}
          aria-label="Type a falling word"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={state.input}
          disabled={paused}
          onChange={(event) => input(event.target.value)}
          // Enter sends the word like space does. While a Vietnamese keyboard is still composing, its Enter only confirms the letters.
          onKeyDown={(event) => event.key === 'Enter' && !event.nativeEvent.isComposing && input(`${event.currentTarget.value}\n`)}
          className={cn(
            'h-14 w-full border bg-background/60 px-4 text-center font-mono text-2xl backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            missing ? 'border-primary text-primary' : 'border-foreground/15',
          )}
        />
      )}
    </div>
  );
};
