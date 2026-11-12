import { ArrowLeft, ArrowRight, Heart } from 'lucide-react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { RainStage } from '@/modules/rain/components/RainStage';
import { Button } from '@/shared/components/ui/button';
import { useMinigameLang } from '@/shared/hooks/use-minigame-lang';
import { cn } from '@/shared/lib/utils';
import { BOT_LEVELS, practiceReducer, PRACTICE_PACE, startPractice, type BotLevel, type PracticeSide, type PracticeState } from '../lib/practice-duel';
import type { CoachStats } from '../types/tutorial.types';
import { BotSprite } from './BotSprite';
import { Ping } from './Ping';

const TICK_MS = 100;

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** The texts of the duel's screen: the Bot duel in the minigames' language, the tutorial's duel as it always was. */
const DUEL_TEXT = {
  en: {
    you: 'You',
    words: 'words',
    yourField: 'Your field',
    field: (name: string) => `${name}'s field`,
    threw: (name: string, text: string) => `${name} threw: ${text}`,
    incoming: 'Watch out, a word is coming!',
    typeWord: 'Type a falling word',
    timeLeft: 'Time left',
    lives: (who: string, n: number) => `${who}: ${n} ${n === 1 ? 'life' : 'lives'} left`,
    moveLeft: "Move the bot's field to the left",
    moveRight: "Move the bot's field to the right",
  },
  vi: {
    you: 'Bạn',
    words: 'từ',
    yourField: 'Màn của bạn',
    field: (name: string) => `Màn của ${name}`,
    threw: (name: string, text: string) => `${name} ném: ${text}`,
    incoming: 'Coi chừng, có chữ bay tới!',
    typeWord: 'Gõ chữ đang rơi',
    timeLeft: 'Thời gian còn lại',
    lives: (who: string, n: number) => `${who}: còn ${n} mạng`,
    moveLeft: 'Chuyển màn của bot sang trái',
    moveRight: 'Chuyển màn của bot sang phải',
  },
} as const;
const TUTORIAL_TEXT = { ...DUEL_TEXT.en, incoming: 'Ối, chữ bay tới kìa!' };

const Lives = ({ who, lives, label }: { who: string; lives: number; label: (who: string, n: number) => string }) => (
  <div role="img" aria-label={label(who, lives)} className="flex gap-0.5 text-primary">
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

/** Ping's moves as the Bot duel's bots play them. */
const BOT_MOVES = { typing: 'typing', happy: 'win', sad: 'lose' } as const;

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
  /** The Bot duel's level: its bot (Bông, Nhịp, Dạ) and pace. Without it, the tutorial's duel against Ping at Bronze. */
  level?: BotLevel;
  skipLabel?: string;
}

/**
 * The practice rain duel against a bot (Ping in the tutorial, a level's bot in the Bot duel), in the layout of the ranked
 * rain duel: my field large with the box under it, the bot's small beside it (a strip above it on a phone). It runs only in the browser (`practice-duel.ts`).
 */
export const PracticeDuel = ({ words, onDone, onSkip, level, skipLabel = 'Bỏ qua' }: PracticeDuelProps) => {
  const [state, dispatch] = useReducer(practiceReducer, words, (list) => startPractice(shuffled(list), Math.random, level));
  const { lang } = useMinigameLang();
  const t = level ? DUEL_TEXT[lang] : TUTORIAL_TEXT;
  const botName = level ? BOT_LEVELS[level].name : 'Ping';
  const tier = level ? BOT_LEVELS[level].tier : 'Bronze';
  const move = pingMove(state);
  const [box, setBox] = useState('');
  /** Which side of my field the bot's field is on (from `lg` up; on a phone it is a strip above). */
  const [botSide, setBotSide] = useState<'left' | 'right'>('right');
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
      <div className={cn('grid gap-3', botSide === 'right' ? 'lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]')}>
        <section aria-label={t.yourField} className={cn('order-2 flex min-w-0 flex-col gap-2', botSide === 'right' ? 'lg:order-1' : 'lg:order-2')}>
          <div className="flex h-9 items-center gap-3 text-[1.125rem] text-muted-foreground">
            <span className="flex shrink-0 items-center gap-2 font-semibold text-primary">
              {t.you} <Lives who={t.you} lives={state.me.lives} label={t.lives} />
            </span>
            <p role="status" className="min-w-0 flex-1 truncate text-center">
              {thrownAtMe && (
                <span key={thrownAtMe.at} className="rain-banner bg-primary/80 px-2 py-0.5 font-semibold text-primary-foreground">
                  {t.threw(botName, thrownAtMe.text)}
                </span>
              )}
            </p>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold text-primary">{state.me.hits}</span> {t.words}
            </span>
            {/* the tutorial's duel has a way out; the Bot duel has its own button under it */}
            {!level && (
              <Button variant="ghost" size="sm" onClick={onSkip}>
                {skipLabel}
              </Button>
            )}
          </div>
          <div className="relative">
            <RainStage drops={state.me.drops} avatar={me?.avatar ?? DEFAULT_AVATAR} phase="playing" paused={over} />
            {/* a button to put the bot's field on the other side of mine, in the bottom left corner */}
            <Button
              type="button"
              variant="ghost"
              aria-label={botSide === 'right' ? t.moveLeft : t.moveRight}
              onClick={() => setBotSide(botSide === 'right' ? 'left' : 'right')}
              className="absolute bottom-1 left-2 z-10 hidden size-9 p-0 text-primary hover:bg-primary hover:text-primary-foreground lg:inline-flex"
            >
              {botSide === 'right' ? <ArrowRight className="size-5" aria-hidden="true" /> : <ArrowLeft className="size-5" aria-hidden="true" />}
            </Button>
            {/* the level and the clock, in the bottom right corner of my field */}
            <span className="pointer-events-none absolute right-3 bottom-2 z-10 flex items-center gap-2 text-[1.125rem] text-muted-foreground">
              {tier}
              <span aria-label={t.timeLeft} className="text-xl font-semibold tabular-nums text-primary">
                {clock(PRACTICE_PACE.durationMs - state.elapsed)}
              </span>
            </span>
          </div>
        </section>
        <section aria-label={t.field(botName)} className={cn('relative order-1 flex min-w-0 flex-col gap-2', botSide === 'right' ? 'lg:order-2' : 'lg:order-1')}>
          <div className="flex h-9 items-center justify-between gap-3 text-[1.125rem] text-muted-foreground">
            <span className="flex items-center gap-2 font-semibold text-primary">
              {botName} <Lives who={botName} lives={state.bot.lives} label={t.lives} />
            </span>
            <span className="tabular-nums">
              <span className="font-semibold text-primary">{state.bot.hits}</span> {t.words}
            </span>
          </div>
          <RainStage
            drops={state.bot.drops}
            avatar={DEFAULT_AVATAR}
            character={level ? <BotSprite level={level} move={BOT_MOVES[move]} /> : <Ping move={move} />}
            phase="playing"
            paused={over}
            compact
            className="h-28 lg:h-[60vh] lg:min-h-80"
          />
          {thrownAtPing && <p className="absolute inset-x-2 top-8 z-10 border bg-background/85 px-2 py-1 text-xs backdrop-blur-sm">{t.incoming}</p>}
        </section>
      </div>
      <input
        ref={input}
        aria-label={t.typeWord}
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
        className="h-14 w-full border border-foreground/15 bg-background/60 px-4 text-center font-mono text-2xl backdrop-blur-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
};
