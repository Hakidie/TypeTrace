import { Languages, Lightbulb, Link2, SkipForward, Timer, Trophy } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { DEFAULT_AVATAR, type AvatarPose } from '@/modules/avatar/types/avatar.types';
import { BotSprite, type BotMove } from '@/modules/tutorial/components/BotSprite';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useMinigamePlay } from '@/modules/daily-tasks/hooks/use-minigame-play';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Lottie } from '@/shared/components/lottie';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useSaveWordChainScore, useWordBank } from '../hooks/use-word-chain';
import { useWordChainGame, type ChainLink } from '../hooks/use-word-chain-game';
import { WordChainBoard } from './WordChainBoard';
import { BONUS_TIERS, HINT_COST_MS, SKIP_COST_MS, START_MS } from '../lib/word-chain';
import { useWordChainLang, type WordChainText } from '../lib/word-chain-text';

const seconds = (ms: number) => Math.ceil(ms / 1000);

/** The trophy beside the score: opens the leaderboard in a modal, with a link to the Minigames tab of the Leaderboard page. */
const BoardButton = ({ text }: { text: WordChainText }) => (
  <Dialog>
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button type="button" variant="ghost" aria-label={text.leaderboard} className="mb-[3px] size-8 p-0 text-primary hover:bg-primary hover:text-primary-foreground">
              <Trophy className="size-6" aria-hidden="true" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{text.leaderboard}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    <DialogContent className="max-w-md gap-4 border-border bg-background/75 backdrop-blur-xs transition-colors hover:border-destructive/40">
      <DialogHeader>
        <DialogTitle>{text.leaderboardTitle}</DialogTitle>
        <DialogDescription>{text.leaderboardHint}</DialogDescription>
      </DialogHeader>
      <WordChainBoard text={text} className="border-0 bg-transparent backdrop-blur-none" />
      <Button asChild variant="outline">
        <RouterLink to="/leaderboard?tab=minigames">{text.openLeaderboardPage}</RouterLink>
      </Button>
    </DialogContent>
  </Dialog>
);

/** A glass card over the board, for the start and result screens (as in Rain). */
const Overlay = ({ children }: { children: ReactNode }) => (
  <div className="absolute inset-0 z-20 grid place-items-center bg-background/40 p-4 backdrop-blur-[2px]">
    <div className="duel-pop flex w-full max-w-sm flex-col items-center gap-4 border border-border bg-background/75 p-6 text-center backdrop-blur-xs transition-colors hover:border-destructive/40">
      {children}
    </div>
  </div>
);

/** One word of the chain: the bot's on the left, yours on the right, the syllable to chain from in red. */
const Link = ({ link, latest, text }: { link: ChainLink; latest: boolean; text: WordChainText }) => {
  const [first, second] = link.word.split(' ');
  const mine = link.by === 'me';
  return (
    <li
      className={cn('chain-in flex items-center gap-2', mine ? 'justify-end [--chain-from:0.75rem]' : 'justify-start')}
      aria-label={`${mine ? text.you : 'Bot'}: ${link.word}`}
    >
      {!mine && <span className="w-7 text-xs uppercase tracking-wider text-muted-foreground">Bot</span>}
      <span
        className={cn(
          'relative border px-3 py-1.5 text-lg sm:text-xl',
          mine ? 'border-primary/40 bg-primary/10' : 'border-border bg-background/40',
          latest && !mine && 'border-primary/60',
        )}
      >
        {first} <span className="font-semibold text-primary">{second}</span>
        {link.bonusMs ? (
          <span key={link.id} aria-hidden="true" className="chain-bonus absolute -top-3 right-1 text-sm font-bold text-primary">
            +{link.bonusMs / 1000}s
          </span>
        ) : null}
      </span>
    </li>
  );
};

/**
 * The Nối từ game of the Minigames tab (`?mode=minigames&game=chain`): chain two-syllable Vietnamese words with a
 * friendly bot before the 60 s clock runs out. A right word scores a point and adds time by how fast it was typed;
 * a refused word, a hint or a skip costs time. The linking syllable is typed for the player. A finished game goes to the
 * leaderboard (`POST /api/word-chain/scores`, the server checks the chain); the best score shown is kept in this browser.
 * The player's avatar and the bot lean on the sides of the board and react to each answer.
 */
export const WordChainMode = () => {
  const bank = useWordBank();
  const { data: me } = useCurrentUser();
  const save = useSaveWordChainScore();
  const { mutate: saveScore } = save;
  // every game that runs to its end counts for the daily task `minigames`, with or without a point (SCRUM-300)
  const { begin: beginPlay, finish: finishPlay } = useMinigamePlay('chain');
  // a finished game with points goes to the leaderboard (the server works the score out again)
  const onOver = useCallback(
    (chain: ChainLink[], score: number) => {
      finishPlay();
      if (score > 0) saveScore(chain.map(({ by, word }) => ({ by, word })));
    },
    [saveScore, finishPlay],
  );
  const { text: t, toggle: toggleLang } = useWordChainLang();
  const game = useWordChainGame(bank.data, me?._id ?? 'guest', onOver, t);
  /** How the avatar and the bot react to the last answer, for a moment. */
  const [reaction, setReaction] = useState<'good' | 'bad' | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const react = (kind: 'good' | 'bad') => {
    setReaction(kind);
    clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => setReaction(null), 1200);
  };
  useEffect(() => () => clearTimeout(reactionTimer.current), []);
  const [text, setText] = useState('');
  const [shake, setShake] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const playing = game.phase === 'playing';

  // keep the newest words in view, and the box focused while playing
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [game.chain.length]);
  useEffect(() => {
    if (playing) box.current?.focus();
  }, [playing, game.chain.length]);

  if (bank.isLoading) return <LoadingState rows={3} />;
  if (bank.isError) return <ErrorState error={bank.error} onRetry={() => bank.refetch()} />;
  if (!bank.data?.botWords.length)
    return <EmptyState icon={Link2} title={t.noWordList} description={t.noWordListHint} />;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    if (game.submit(text)) {
      setText('');
      react('good');
    } else {
      setShake((n) => n + 1);
      react('bad');
    }
  };
  const startGame = () => {
    setText('');
    beginPlay();
    game.start();
  };
  const urgent = playing && game.leftMs <= 10_000;
  const over = game.phase === 'over';
  const myPose: AvatarPose =
    reaction === 'good' || (over && game.newBest) ? 'win' : reaction === 'bad' || (over && !game.newBest) ? 'lose' : playing && text ? 'typing' : 'idle';
  const botMove: BotMove = reaction === 'good' ? 'lose' : reaction === 'bad' ? 'win' : playing && !text ? 'typing' : 'idle';

  return (
    <div className="mx-auto w-full max-w-6xl">
      <section aria-label={t.title} className="flex w-full flex-col gap-4 lg:px-24">
        {/* the clock, the time bar and the score */}
        <div className="flex items-end justify-between gap-4">
          <div className={cn('flex items-center gap-2 tabular-nums', urgent ? 'text-destructive' : 'text-primary')}>
            <Timer className="size-5" aria-hidden="true" />
            <span role="timer" aria-label={t.timeLeft} className={cn('inline-block text-3xl font-bold', urgent && 'chain-urgent')}>
              {seconds(game.leftMs)}s
            </span>
          </div>
          <dl className="ml-auto flex gap-5 text-sm text-muted-foreground">
            <div className="flex items-baseline gap-1.5">
              <dt>{t.score}</dt>
              <dd className="text-2xl font-semibold tabular-nums text-primary">{game.score}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt>{t.best}</dt>
              <dd className="text-2xl font-semibold tabular-nums text-primary">{game.best}</dd>
            </div>
          </dl>
          <BoardButton text={t} />
        </div>
        <div className="h-1.5 bg-muted" aria-hidden="true">
          <div
            className={cn('h-full transition-[width] duration-100 ease-linear', urgent ? 'bg-destructive' : 'bg-primary')}
            style={{ width: `${Math.min(100, (game.leftMs / START_MS) * 100)}%` }}
          />
        </div>

        {/* the board: the chain, then what to type */}
        <div className="relative flex min-h-[30rem] flex-col border border-primary/20 bg-background/30 backdrop-blur-sm">
          {/* the bot leans on the left side of the board, the player's avatar on the right (decorative: the chain says it all) */}
          <div aria-hidden="true" className="pointer-events-none absolute -left-[4.5rem] bottom-6 hidden lg:block">
            <BotSprite level="medium" move={botMove} />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute -right-[5.5rem] bottom-4 hidden -scale-x-100 lg:block">
            <AvatarSprite look={me?.avatar ?? DEFAULT_AVATAR} pose={myPose} scale={1.25} eager />
          </div>
          <ol ref={list} className="flex max-h-96 flex-1 flex-col gap-2.5 overflow-y-auto p-4" aria-label={t.chainList}>
            {game.chain.map((link, i) => (
              <Link key={link.id} link={link} latest={i === game.chain.length - 1} text={t} />
            ))}
          </ol>
          <div className="border-t border-primary/15 p-4">
            <p className="mb-3 text-center text-sm text-muted-foreground">
              {t.chainFrom} <span className="ml-1 text-3xl font-bold text-primary">{game.prompt || '...'}</span>
            </p>
            <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
              {/* the linking syllable is typed for the player: a fixed part of the box, in red, before what they type */}
              <div className="flex h-12 min-w-0 flex-1 border border-input bg-background/60 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring">
                {game.prompt && (
                  <span
                    aria-hidden="true"
                    className="flex shrink-0 items-center gap-1.5 border-r border-primary/25 bg-primary/10 px-3 text-lg font-semibold text-primary"
                  >
                    {game.prompt}
                    <span className="text-[10px] font-normal uppercase tracking-wider text-primary/70">{t.given}</span>
                  </span>
                )}
                <label htmlFor="word-chain-box" className="sr-only">
                  {t.secondSyllable(game.prompt)}
                </label>
                <input
                  id="word-chain-box"
                  ref={box}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  disabled={!playing}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder={game.prompt ? t.typeSecond : ''}
                  className="h-full min-w-0 flex-1 bg-transparent px-3 text-lg outline-none disabled:opacity-60"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-12 flex-1 gap-1.5 sm:flex-none" onClick={game.hint} disabled={!playing}>
                  <Lightbulb className="size-4" aria-hidden="true" /> {t.hint} <span className="text-xs text-muted-foreground">−{HINT_COST_MS / 1000}s</span>
                </Button>
                <Button type="button" variant="outline" className="h-12 flex-1 gap-1.5 sm:flex-none" onClick={game.skip} disabled={!playing}>
                  <SkipForward className="size-4" aria-hidden="true" /> {t.skip} <span className="text-xs text-muted-foreground">−{SKIP_COST_MS / 1000}s</span>
                </Button>
              </div>
            </form>
            {/* a refused word shakes the message once (a new key replays the shake) */}
            <p
              key={shake}
              role="status"
              className={cn(
                'mt-2 min-h-5 text-center text-sm',
                shake > 0 && game.feedback?.kind === 'bad' && 'auth-shake',
                game.feedback?.kind === 'bad' ? 'text-destructive' : game.feedback?.kind === 'good' ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {game.feedback?.text}
            </p>
          </div>

          {game.phase === 'ready' && (
            <Overlay>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <Link2 className="size-8" aria-hidden="true" /> {t.title}
              </h2>
              <p className="text-base text-muted-foreground">{t.rules(START_MS / 1000)}</p>
              <ul className="grid w-full grid-cols-2 gap-1.5 text-base text-muted-foreground">
                {BONUS_TIERS.map((tier) => (
                  <li key={tier.ms} className="border border-primary/20 px-2 py-1">
                    {tier.minWpm ? `≥ ${tier.minWpm} WPM` : t.slower}: <span className="font-semibold text-primary">+{tier.ms / 1000}s</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" onClick={startGame} autoFocus>
                {t.start}
              </Button>
            </Overlay>
          )}

          {game.phase === 'over' && (
            <Overlay>
              {game.newBest && (
                <div className="relative grid size-24 place-items-center">
                  <Lottie name="confetti" className="absolute inset-0 size-full" />
                  <Lottie name="trophy" className="size-20" />
                </div>
              )}
              <h2 className="text-2xl font-bold">{game.newBest ? t.newBest : t.timesUp}</h2>
              <p className="text-muted-foreground">
                {t.scored} <span className="text-3xl font-bold tabular-nums text-foreground">{game.score}</span> {t.scoredPoints}{' '}
                <span className="font-semibold text-foreground">{game.best}</span>.
              </p>
              <Button className="w-full" onClick={startGame} autoFocus>
                {t.playAgain}
              </Button>
            </Overlay>
          )}
        </div>
        {/* the language of the game's texts, under the board */}
        <div className="flex justify-center">
          <Button type="button" variant="ghost" onClick={toggleLang} className="h-8 gap-1.5 px-2 text-sm text-muted-foreground hover:bg-primary hover:text-primary-foreground">
            <Languages className="size-4" aria-hidden="true" /> {t.switchTo}
          </Button>
        </div>
      </section>
    </div>
  );
};
