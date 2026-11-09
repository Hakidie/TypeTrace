import { ArrowLeft, ArrowRight, CloudRain } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { RainMode } from '@/modules/rain/components/RainMode';
import { BotDuelMode } from '@/modules/tutorial/components/BotDuelMode';
import { BotSprite } from '@/modules/tutorial/components/BotSprite';
import { WordChainMode } from '@/modules/word-chain/components/WordChainMode';
import { useWordChainBoard } from '@/modules/word-chain/hooks/use-word-chain';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export type MinigameId = 'rain' | 'bot' | 'chain';

const GAMES: Record<MinigameId, () => React.JSX.Element> = { rain: RainMode, bot: BotDuelMode, chain: WordChainMode };

/** The frame of a game tile: square, glass, red border on hover and focus, a small lift when pressed. */
const tile =
  'group relative flex cursor-pointer overflow-hidden border border-primary/20 bg-background/30 text-left backdrop-blur-sm transition-[border-color,transform] duration-200 hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]';

/** The facts of a game, in one quiet line. */
const Facts = ({ items }: { items: string[] }) => (
  <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
    {items.map((fact) => (
      <span key={fact}>{fact}</span>
    ))}
  </span>
);

const Play = ({ label = 'Play' }: { label?: string }) => (
  <span className="flex items-center gap-2 text-sm font-semibold text-primary">
    {label} <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
  </span>
);

/** The three words of the chain on the Nối từ tile, drawn like the words of the game (decorative). */
const CHAIN_PREVIEW = [
  ['học', 'sinh'],
  ['sinh', 'viên'],
  ['viên', 'chức'],
];

/** The player's place on this week's Nối từ board, when they have one. */
const WeekPlace = () => {
  const board = useWordChainBoard('week');
  const me = board.data?.me;
  if (!me) return null;
  return (
    <span className="text-sm text-muted-foreground">
      Tuần này bạn đứng thứ <span className="font-semibold text-foreground">{me.rank}</span>, {me.score} điểm
    </span>
  );
};

/** A tile appears a little after the one before it (`duel-rise`, still for reduced motion). */
const rise = (index: number): CSSProperties => ({ animationDelay: `${index * 70}ms` });

/**
 * The Minigames tab of the Typing page (`?mode=minigames`). Nối từ, the newest game, takes the large tile on the left with a
 * preview of a chain and the player's place this week; Rain and the Bot duel stack on the right, art beside their text. One
 * column on phones. The picked game lives in the URL (`&game=rain|bot|chain`) and opens in place of the tiles, with a button
 * under it, in the center, back to them.
 */
export const MinigamesMode = ({ game, onSelect, onBack }: { game?: MinigameId; onSelect: (id: MinigameId) => void; onBack: () => void }) => {
  if (game) {
    const Game = GAMES[game];
    return (
      <div className="flex flex-1 flex-col gap-4">
        {/* The game sits in the middle of the free height, between the tabs and the back button. */}
        <div className="flex flex-1 flex-col justify-center">
          <Game />
        </div>
        <div className="mt-auto flex justify-center pb-4">
          <Button variant="ghost" className="h-auto gap-2 px-3 py-1.5 text-base text-muted-foreground" onClick={onBack}>
            <ArrowLeft className="size-4" /> All minigames
          </Button>
        </div>
      </div>
    );
  }

  const side = (id: MinigameId, index: number, title: string, description: string, facts: string[], art: ReactNode, artWidth = 'sm:w-40') => (
    <button
      type="button"
      onClick={() => onSelect(id)}
      style={rise(index)}
      className={cn(tile, 'duel-rise min-h-56 flex-col-reverse items-stretch gap-6 p-6 sm:flex-row sm:items-center')}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-3">
        <span className="text-2xl font-bold text-primary">{title}</span>
        <span className="text-base text-muted-foreground">{description}</span>
        <Facts items={facts} />
        <Play />
      </span>
      <span aria-hidden="true" className={`flex shrink-0 items-center justify-center transition-transform duration-200 group-hover:scale-105 ${artWidth}`}>
        {art}
      </span>
    </button>
  );

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 content-center gap-5 py-8 lg:grid-cols-[1.25fr_1fr] lg:grid-rows-2">
      {/* Nối từ: the large tile */}
      <button
        type="button"
        onClick={() => onSelect('chain')}
        style={rise(0)}
        className={cn(tile, 'duel-rise flex-col gap-6 p-7 lg:row-span-2 lg:p-9')}
      >
        <span className="flex flex-col gap-3">
          <span className="text-3xl font-bold text-primary lg:text-4xl">Nối từ</span>
          <span className="max-w-[40ch] text-base text-muted-foreground">
            Chain Vietnamese words with a friendly bot. The faster you type, the more time you get.
          </span>
        </span>
        {/* a real chain in the look of the game: the bot's word, yours, the bot's answer */}
        <span aria-hidden="true" className="flex flex-1 flex-col justify-center gap-2.5 py-2">
          {CHAIN_PREVIEW.map(([first, second], i) => (
            <span
              key={second}
              className={cn(
                'w-fit border px-4 py-2 text-2xl transition-transform duration-300',
                i % 2 ? 'self-end border-primary/40 bg-primary/10 group-hover:-translate-x-1' : 'border-border bg-background/40 group-hover:translate-x-1',
              )}
            >
              {first} <span className="font-semibold text-primary">{second}</span>
            </span>
          ))}
        </span>
        <span className="flex flex-col gap-3">
          <Facts items={['60 seconds', 'Speed adds time', 'Weekly leaderboard']} />
          <WeekPlace />
          <Play label="Play Nối từ" />
        </span>
      </button>

      {side(
        'rain',
        1,
        'Rain',
        'Type the falling words before they land.',
        ['1 minute', 'Solo'],
        <CloudRain className="size-24 text-primary" strokeWidth={1.25} />,
      )}
      {side(
        'bot',
        2,
        'Bot duel',
        'A word rain duel against Bông, Nhịp or Dạ. Throw words at the bot, keep your lives.',
        ['2 minutes', '3 levels', 'Unrated'],
        // the three bots side by side, the hardest in the middle
        <span className="flex items-end gap-1">
          <BotSprite level="easy" move="idle" />
          <BotSprite level="hard" move="idle" size={2} />
          <BotSprite level="medium" move="idle" />
        </span>,
        'sm:w-64',
      )}
    </div>
  );
};
