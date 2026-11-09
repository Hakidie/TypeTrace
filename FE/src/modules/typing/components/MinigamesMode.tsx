import { ArrowLeft, ArrowRight, CalendarDays, CloudRain, Link2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { DailyMode } from '@/modules/daily/components/DailyMode';
import { RainMode } from '@/modules/rain/components/RainMode';
import { hoverFrame, titleClass } from '@/modules/ranked/components/RankLobby';
import { BotDuelMode } from '@/modules/tutorial/components/BotDuelMode';
import { BotSprite } from '@/modules/tutorial/components/BotSprite';
import { WordChainMode } from '@/modules/word-chain/components/WordChainMode';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export type MinigameId = 'rain' | 'daily' | 'bot' | 'chain';

const BigIcon = ({ icon: Icon }: { icon: LucideIcon }) => <Icon className="size-28 text-primary" strokeWidth={1.25} aria-hidden="true" />;

const minigames: { id: MinigameId; title: string; description: string; facts: string[]; art: ReactNode }[] = [
  { id: 'rain', title: 'Rain', description: 'Type the falling words before they land.', facts: ['1 minute', 'Solo', 'Beat your best'], art: <BigIcon icon={CloudRain} /> },
  { id: 'daily', title: 'Daily', description: 'One passage for everyone each day. Beat your last try and climb the board.', facts: ['New every day', 'Leaderboard', 'Coins'], art: <BigIcon icon={CalendarDays} /> },
  {
    id: 'bot',
    title: 'Bot duel',
    description: 'A word rain duel against Bông, Nhịp or Dạ. Throw words at the bot, keep your lives.',
    facts: ['2 minutes', '3 levels', 'Unrated'],
    // The three bots stand side by side, the hardest in the middle (decorative: the card's title names the game).
    art: (
      <span aria-hidden="true" className="flex items-end gap-1">
        <BotSprite level="easy" move="idle" />
        <BotSprite level="hard" move="idle" size={2} />
        <BotSprite level="medium" move="idle" />
      </span>
    ),
  },
  {
    id: 'chain',
    title: 'Nối từ',
    description: 'Chain Vietnamese words with a friendly bot. The faster you type, the more time you get.',
    facts: ['60 seconds', 'Speed adds time', 'Beat your best'],
    art: <BigIcon icon={Link2} />,
  },
];
const GAMES: Record<MinigameId, () => React.JSX.Element> = { rain: RainMode, daily: DailyMode, bot: BotDuelMode, chain: WordChainMode };

/**
 * The Minigames tab of the Typing page (`?mode=minigames`): a card for each minigame. The picked one lives in the URL
 * (`&game=rain|daily|bot|chain`) and opens in place of the cards, with a button under it, in the center, back to them.
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
  // A framed card for each game, as tall as the free height: its title, its art, what it is, a few facts and a Play line.
  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 py-8 md:grid-cols-2 md:gap-8 xl:grid-cols-4">
      {minigames.map(({ id, title, description, facts, art }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={cn(
            hoverFrame,
            'group min-h-80 cursor-pointer items-center gap-4 bg-background/30 p-6 text-center backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-[28rem]',
          )}
        >
          <span className={cn(titleClass, 'font-bold')}>{title}</span>
          <span className="flex flex-1 items-center justify-center transition-transform duration-200 group-hover:scale-105">{art}</span>
          <span className="text-base text-muted-foreground">{description}</span>
          <span className="flex flex-wrap justify-center gap-2">
            {facts.map((fact) => (
              <span key={fact} className="border border-primary/30 px-2 py-0.5 text-xs uppercase tracking-wider text-primary">
                {fact}
              </span>
            ))}
          </span>
          <span className="mt-2 flex items-center gap-2 text-sm font-semibold text-primary">
            Play <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </button>
      ))}
    </div>
  );
};
