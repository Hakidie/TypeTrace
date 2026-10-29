import { Heart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RainStage } from '@/modules/rain/components/RainStage';
import type { RainDrop, RainReaction } from '@/modules/rain/types/rain.types';
import { cn } from '@/shared/lib/utils';
import { useRainDuel, useSendRainWord } from '../hooks/use-match';
import type { RainDuelSide } from '../lib/rain-duel';
import type { MatchPlayerView, PublicMatch } from '../types/ranked.types';
import { Countdown } from './Countdown';

const LIVES = 3;

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** The time left of the duel, ticking every second. */
const useTimeLeft = (endsAt?: string) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return endsAt ? Date.parse(endsAt) - now : undefined;
};

const Lives = ({ who, lives }: { who: string; lives: number }) => (
  <div role="img" aria-label={`${who}: ${lives} ${lives === 1 ? 'life' : 'lives'} left`} className="flex gap-0.5 text-primary">
    {Array.from({ length: LIVES }, (_, index) => (
      <Heart key={index} aria-hidden="true" className={cn('size-4', index < lives ? 'fill-current' : 'opacity-40')} />
    ))}
  </div>
);

/** The falling word that starts with what is typed and lands first (English only: no marks to ignore). */
const targetOf = (side: RainDuelSide | undefined, typed: string) => {
  if (!side || !typed) return undefined;
  return side.drops
    .filter((drop) => drop.state === 'falling' && drop.text.startsWith(typed))
    .sort((a, b) => (a.bornAt ?? 0) + a.fallMs - ((b.bornAt ?? 0) + b.fallMs))[0];
};

/** The hop of the last word typed on this side, or the shake of the last word landed, whichever came last. */
const reactionOf = (hit: { side: string; at: number } | undefined, land: { side: string; at: number } | undefined, side: string): RainReaction | null => {
  const hop = hit?.side === side ? hit.at : -1;
  const shake = land?.side === side ? land.at : -1;
  if (hop < 0 && shake < 0) return null;
  return hop >= shake ? { kind: 'hop', key: hop } : { kind: 'shake', key: shake };
};

interface RainDuelViewProps {
  match: PublicMatch;
  myId?: string;
}

/**
 * A rain duel (layout B of the rain duel design): the own field large with the typing box under it, the other player's
 * field small beside it (a strip above it on a phone). Everything comes from the server: the words with their age
 * (`clockNow`), the hits and the landings; the box only sends a word on space or Enter.
 */
export const RainDuelView = ({ match, myId }: RainDuelViewProps) => {
  const { state, clock: serverClock } = useRainDuel(match.code);
  const send = useSendRainWord();
  const [input, setInput] = useState('');
  const box = useRef<HTMLInputElement>(null);
  const running = match.status === 'running';
  // The box is disabled during the countdown, and a disabled box cannot take the focus (`autoFocus` does nothing then):
  // it takes it as soon as the duel runs, so the first key already types.
  useEffect(() => {
    if (running) box.current?.focus();
  }, [running]);
  const timeLeft = useTimeLeft(match.endsAt);
  const me = match.players.find((player) => player.userId === myId) ?? match.players[0];
  const other = match.players.find((player) => player !== me) as MatchPlayerView | undefined;
  const mine = state?.sides[me.userId];
  const theirs = other && state?.sides[other.userId];

  const typed = input.trim().toLowerCase();
  const target = targetOf(mine, typed);
  const myDrops: RainDrop[] = (mine?.drops ?? []).map((drop) => ({ ...drop, typed: drop.id === target?.id ? typed.length : 0 }));

  // The moments (rain duel design, four moments): a word I threw flies across, a word thrown at me is announced, the
  // other player's field flashes when they lose a life. Each is keyed by its server time, so a new one replays.
  const lastHit = state?.lastHit;
  const flying = lastHit?.side === me.userId && lastHit.thrownTo ? { at: lastHit.at, text: mine?.drops.find((drop) => drop.id === lastHit.id)?.text } : undefined;
  const incoming = state?.lastThrow?.to === me.userId ? state.lastThrow : undefined;
  const opponentHit = other && state?.lastLand?.side === other.userId ? state.lastLand : undefined;

  const submit = (word: string) => {
    if (word) send.mutate({ code: match.code, text: word });
  };
  // A word goes on space or Enter, like word rain alone; what is typed after the space starts the next word.
  const onChange = (value: string) => {
    const gap = value.search(/\s/);
    if (gap < 0) return setInput(value);
    submit(value.slice(0, gap).trim());
    setInput(value.slice(gap).trimStart());
  };

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-3 py-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        <section aria-label="Your field" className="relative order-2 flex min-w-0 flex-col gap-2 lg:order-1">
          {incoming && (
            <>
              <div key={`flash-${incoming.at}`} aria-hidden="true" className="rain-incoming pointer-events-none absolute inset-x-0 top-7 z-10 h-2 bg-primary" />
              <p key={`banner-${incoming.at}`} role="status" className="rain-banner absolute inset-x-0 top-9 z-10 mx-auto w-fit bg-primary/80 px-3 py-1 text-sm font-semibold text-primary-foreground">
                {other?.displayName ?? 'Your opponent'} threw: {incoming.text}
              </p>
            </>
          )}
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 font-semibold text-foreground">
              You <Lives who="You" lives={mine?.lives ?? LIVES} />
            </span>
            <span className="tabular-nums">{mine?.hits ?? 0} words</span>
            {timeLeft !== undefined && (
              <span aria-label="Time left" className="font-semibold tabular-nums text-foreground">
                {clock(timeLeft)}
              </span>
            )}
          </div>
          <RainStage
            drops={myDrops}
            avatar={me.avatar}
            phase={match.status === 'running' ? 'playing' : 'ready'}
            targetId={target?.id}
            reaction={reactionOf(state?.lastHit, state?.lastLand, me.userId)}
            clockNow={serverClock.now}
          />
        </section>
        {other && (
          <section aria-label={`${other.displayName}'s field`} className="relative order-1 flex min-w-0 flex-col gap-2 lg:order-2">
            {opponentHit && <div key={opponentHit.at} aria-hidden="true" className="rain-opponent-hit pointer-events-none absolute inset-0 z-10 bg-primary/25" />}
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2 truncate font-semibold text-foreground">
                {other.displayName} <Lives who={other.displayName} lives={theirs?.lives ?? LIVES} />
              </span>
              <span className="tabular-nums">{theirs?.hits ?? 0} words</span>
            </div>
            <RainStage
              drops={theirs?.drops ?? []}
              avatar={other.avatar}
              phase={match.status === 'running' ? 'playing' : 'ready'}
              reaction={reactionOf(state?.lastHit, state?.lastLand, other.userId)}
              clockNow={serverClock.now}
              compact
              className="h-28 lg:h-[60vh] lg:min-h-80"
            />
          </section>
        )}
      </div>
      <input
        ref={box}
        aria-label="Type a falling word"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={input}
        disabled={match.status !== 'running'}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
          submit(input.trim());
          setInput('');
        }}
        className={cn(
          'h-14 w-full border bg-background/60 px-4 text-center font-mono text-2xl backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          typed && !target ? 'border-primary text-primary' : 'border-foreground/15',
        )}
      />
      {flying?.text && (
        <span
          key={flying.at}
          aria-hidden="true"
          className="rain-throw pointer-events-none absolute left-[30%] top-1/2 z-30 border border-primary bg-card px-2 py-1 font-mono text-lg font-semibold text-primary"
        >
          {flying.text}
        </span>
      )}
      {match.status === 'countdown' && match.countdownEndsAt && (
        <div className="absolute inset-0 z-20 grid place-items-center">
          <Countdown endsAt={match.countdownEndsAt} />
        </div>
      )}
    </div>
  );
};
