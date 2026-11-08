import { Lightbulb, Link2, SkipForward, Timer } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Lottie } from '@/shared/components/lottie';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useWordBank } from '../hooks/use-word-chain';
import { useWordChainGame, type ChainLink } from '../hooks/use-word-chain-game';
import { BONUS_TIERS, HINT_COST_MS, SKIP_COST_MS, START_MS } from '../lib/word-chain';

const seconds = (ms: number) => Math.ceil(ms / 1000);

/** A glass card over the board, for the start and result screens (as in Rain). */
const Overlay = ({ children }: { children: ReactNode }) => (
  <div className="absolute inset-0 z-20 grid place-items-center bg-background/40 p-4 backdrop-blur-[2px]">
    <div className="duel-pop flex w-full max-w-sm flex-col items-center gap-4 border border-primary/30 bg-card/90 p-6 text-center backdrop-blur-md">
      {children}
    </div>
  </div>
);

/** One word of the chain: the bot's on the left, yours on the right, the syllable to chain from in red. */
const Link = ({ link, latest }: { link: ChainLink; latest: boolean }) => {
  const [first, second] = link.word.split(' ');
  const mine = link.by === 'me';
  return (
    <li
      className={cn('chain-in flex items-center gap-2', mine ? 'justify-end [--chain-from:0.75rem]' : 'justify-start')}
      aria-label={`${mine ? 'Bạn' : 'Bot'}: ${link.word}`}
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
 * a hint or a skip costs time. Browser only: the best score is kept in this browser.
 */
export const WordChainMode = () => {
  const bank = useWordBank();
  const { data: me } = useCurrentUser();
  const game = useWordChainGame(bank.data, me?._id ?? 'guest');
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
  if (!bank.data?.botWords.length) return <EmptyState icon={Link2} title="Chưa có danh sách từ" description="Chạy minigame-words/build-noi-tu.mjs để tạo FE/public/noi-tu/words.txt." />;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    if (game.submit(text)) setText('');
    else setShake((n) => n + 1);
  };
  const startGame = () => {
    setText('');
    game.start();
  };
  const urgent = playing && game.leftMs <= 10_000;

  return (
    <section aria-label="Nối từ" className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {/* the clock, the time bar and the score */}
      <div className="flex items-end justify-between gap-4">
        <div className={cn('flex items-center gap-2 tabular-nums', urgent ? 'text-destructive' : 'text-foreground')}>
          <Timer className="size-5" aria-hidden="true" />
          <span role="timer" aria-label="Thời gian còn lại" className={cn('inline-block text-3xl font-bold', urgent && 'chain-urgent')}>
            {seconds(game.leftMs)}s
          </span>
        </div>
        <dl className="flex gap-5 text-sm text-muted-foreground">
          <div className="flex items-baseline gap-1.5">
            <dt>Điểm</dt>
            <dd className="text-2xl font-bold tabular-nums text-foreground">{game.score}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt>Kỷ lục</dt>
            <dd className="text-2xl font-bold tabular-nums text-foreground">{game.best}</dd>
          </div>
        </dl>
      </div>
      <div className="h-1.5 bg-muted" aria-hidden="true">
        <div
          className={cn('h-full transition-[width] duration-100 ease-linear', urgent ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${Math.min(100, (game.leftMs / START_MS) * 100)}%` }}
        />
      </div>

      {/* the board: the chain, then what to type */}
      <div className="relative flex min-h-[22rem] flex-col border border-primary/20 bg-background/30 backdrop-blur-sm">
        <ol ref={list} className="flex max-h-72 flex-1 flex-col gap-2.5 overflow-y-auto p-4" aria-label="Chuỗi từ">
          {game.chain.map((link, i) => (
            <Link key={link.id} link={link} latest={i === game.chain.length - 1} />
          ))}
        </ol>
        <div className="border-t border-primary/15 p-4">
          <p className="mb-3 text-center text-sm text-muted-foreground">
            Nối tiếp bằng <span className="ml-1 text-3xl font-bold text-primary">{game.prompt || '...'}</span>
          </p>
          <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="word-chain-box" className="sr-only">
              Từ nối tiếp
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
              placeholder={game.prompt ? `${game.prompt} ...` : ''}
              className={cn(
                'h-12 min-w-0 flex-1 border border-input bg-background/60 px-4 text-lg outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
              )}
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="h-12 flex-1 gap-1.5 sm:flex-none" onClick={game.hint} disabled={!playing}>
                <Lightbulb className="size-4" aria-hidden="true" /> Gợi ý <span className="text-xs text-muted-foreground">−{HINT_COST_MS / 1000}s</span>
              </Button>
              <Button type="button" variant="outline" className="h-12 flex-1 gap-1.5 sm:flex-none" onClick={game.skip} disabled={!playing}>
                <SkipForward className="size-4" aria-hidden="true" /> Bỏ qua <span className="text-xs text-muted-foreground">−{SKIP_COST_MS / 1000}s</span>
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
            <Link2 className="size-10 text-primary" aria-hidden="true" />
            <h2 className="text-2xl font-bold">Nối từ</h2>
            <p className="text-sm text-muted-foreground">
              Gõ một từ hai tiếng bắt đầu bằng tiếng cuối của từ bot đưa. Bạn có {START_MS / 1000} giây, mỗi từ đúng được 1 điểm và thêm giờ: gõ càng nhanh thêm càng nhiều.
            </p>
            <ul className="grid w-full grid-cols-2 gap-1.5 text-xs text-muted-foreground">
              {BONUS_TIERS.map((tier) => (
                <li key={tier.ms} className="border border-primary/20 px-2 py-1">
                  {tier.minWpm ? `≥ ${tier.minWpm} WPM` : 'Chậm hơn'}: <span className="font-semibold text-primary">+{tier.ms / 1000}s</span>
                </li>
              ))}
            </ul>
            <Button className="w-full" onClick={startGame} autoFocus>
              Bắt đầu
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
            <h2 className="text-2xl font-bold">{game.newBest ? 'Kỷ lục mới!' : 'Hết giờ'}</h2>
            <p className="text-muted-foreground">
              Bạn được <span className="text-3xl font-bold tabular-nums text-foreground">{game.score}</span> điểm. Kỷ lục: <span className="font-semibold text-foreground">{game.best}</span>.
            </p>
            <Button className="w-full" onClick={startGame} autoFocus>
              Chơi lại
            </Button>
          </Overlay>
        )}
      </div>
    </section>
  );
};
