import { ArrowLeft, ArrowRight, Bot, CloudRain, Link2, Signal, Swords, Timer, Trophy, User, Zap, type LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { RainMode } from '@/modules/rain/components/RainMode';
import { RainPreview } from '@/modules/rain/components/RainPreview';
import { BotDuelMode } from '@/modules/tutorial/components/BotDuelMode';
import { BotDuelPreview } from '@/modules/tutorial/components/BotDuelPreview';
import { WordChainMode } from '@/modules/word-chain/components/WordChainMode';
import { WordChainPreview, WordChainWeekBadge } from '@/modules/word-chain/components/WordChainPreview';
import { Button } from '@/shared/components/ui/button';
import { useMinigameLang, type MinigameLang } from '@/shared/hooks/use-minigame-lang';
import { cn } from '@/shared/lib/utils';

export type MinigameId = 'rain' | 'bot' | 'chain';

const GAMES: Record<MinigameId, () => React.JSX.Element> = { rain: RainMode, bot: BotDuelMode, chain: WordChainMode };

/** The frame of a game tile: square, glass, red border on hover and focus, a small lift when pressed. */
const tile =
  'group relative flex cursor-pointer overflow-hidden border border-primary/20 bg-background/30 text-left backdrop-blur-sm transition-[border-color,transform] duration-200 hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]';

interface FactItem {
  icon: LucideIcon;
  value: string;
  label: string;
}

/** One fact of a game: its icon beside the value over a small label, two lines as tall as the Play button (`h-9`). */
const Fact = ({ icon: Icon, value, label }: FactItem) => (
  <span className="flex h-9 items-center gap-2">
    <Icon className="size-7 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
    <span className="flex flex-col text-xs leading-4">
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <span>{label}</span>
    </span>
  </span>
);

/** The filled "Play" button of a tile (the tile is the real button; this only looks like one). */
const Play = ({ label, className }: { label: string; className?: string }) => (
  <span
    className={cn(
      'flex h-9 shrink-0 items-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-200 group-hover:-translate-y-0.5',
      className,
    )}
  >
    {label} <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
  </span>
);

/** The texts of the tiles, in each language (English until the player switches them with the button in a game). */
const TEXT: Record<
  MinigameLang,
  {
    play: string;
    back: string;
    chain: { title: string; about: string; facts: [string, string][] };
    rain: { title: string; about: string; facts: [string, string][] };
    bot: { title: string; about: string; facts: [string, string][] };
  }
> = {
  en: {
    play: 'Play',
    back: 'All minigames',
    chain: {
      title: 'Word chain',
      about: 'Chain Vietnamese words with a friendly bot. The faster you type, the more time you get.',
      facts: [
        ['60s', 'on the clock'],
        ['+2 to +5s', 'per word'],
        ['Weekly', 'ranking'],
      ],
    },
    rain: {
      title: 'Rain',
      about: 'Type the falling words before they land.',
      facts: [
        ['1 minute', 'per round'],
        ['Solo', 'play alone'],
      ],
    },
    bot: {
      title: 'Bot duel',
      about: 'Duel a bot in word rain. Throw words at it, keep your lives.',
      facts: [
        ['2 minutes', 'per duel'],
        ['PvE', 'unrated'],
        ['3 levels', 'Bông to Dạ'],
      ],
    },
  },
  vi: {
    play: 'Chơi',
    back: 'Tất cả minigame',
    chain: {
      title: 'Nối từ',
      about: 'Nối từ tiếng Việt với một bot thân thiện. Gõ càng nhanh, bạn càng được thêm nhiều giờ.',
      facts: [
        ['60 giây', 'mỗi ván'],
        ['+2 đến +5 giây', 'mỗi từ'],
        ['Hằng tuần', 'xếp hạng'],
      ],
    },
    rain: {
      title: 'Mưa chữ',
      about: 'Gõ những chữ đang rơi trước khi chúng chạm đất.',
      facts: [
        ['1 phút', 'mỗi lượt'],
        ['Một mình', 'chơi đơn'],
      ],
    },
    bot: {
      title: 'Đấu bot',
      about: 'Đấu mưa chữ với bot. Ném chữ sang bot, giữ cho mình còn mạng.',
      facts: [
        ['2 phút', 'mỗi trận'],
        ['PvE', 'không xếp hạng'],
        ['3 cấp độ', 'từ Bông đến Dạ'],
      ],
    },
  },
};

/** Facts from a text's `[value, label]` pairs, each with its own icon. */
const factsOf = (pairs: [string, string][], icons: LucideIcon[]): FactItem[] => pairs.map(([value, label], i) => ({ icon: icons[i], value, label }));

/** A tile appears a little after the one before it (`duel-rise`, still for reduced motion). */
const rise = (index: number): CSSProperties => ({ animationDelay: `${index * 70}ms` });

/**
 * The Minigames tab of the Typing page (`?mode=minigames`). Word chain (Nối từ), the newest game, takes the large tile on the left with a
 * preview of a chain and the player's place this week; Rain and the Bot duel stack on the right, art beside their text. One
 * column on phones. The picked game lives in the URL (`&game=rain|bot|chain`) and opens in place of the tiles, with a button
 * under it, in the center, back to them.
 */
export const MinigamesMode = ({ game, onSelect, onBack }: { game?: MinigameId; onSelect: (id: MinigameId) => void; onBack: () => void }) => {
  const { lang } = useMinigameLang();
  const t = TEXT[lang];
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
            <ArrowLeft className="size-4" /> {t.back}
          </Button>
        </div>
      </div>
    );
  }

  const side = (id: MinigameId, index: number, Icon: LucideIcon, title: string, description: string, facts: FactItem[], art: ReactNode, artWidth = 'sm:w-40') => (
    <button type="button" onClick={() => onSelect(id)} style={rise(index)} className={cn(tile, 'duel-rise flex-col-reverse items-stretch gap-5 p-5 sm:flex-row')}>
      {/* left: title, description, facts and the Play button */}
      <span className="flex min-w-0 flex-1 flex-col gap-3">
        <span className="flex items-center gap-2.5 text-2xl font-bold text-primary">
          <Icon className="size-6" aria-hidden="true" /> {title}
        </span>
        <span className="text-base text-muted-foreground">{description}</span>
        {/* the facts sit right above the button, at the bottom of the column */}
        <span className="mt-auto flex flex-col gap-3 pt-3">
          <span className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
            {facts.map((fact) => (
              <Fact key={fact.label} {...fact} />
            ))}
          </span>
          <span className="flex">
            <Play label={t.play} />
          </span>
        </span>
      </span>
      {/* right: the game drawn with its own pieces */}
      <span aria-hidden="true" className={`flex shrink-0 items-center justify-center transition-transform duration-200 ${artWidth}`}>
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
        className={cn(tile, 'duel-rise flex-col gap-6 p-5 lg:row-span-2')}
      >
        <span className="flex flex-wrap items-start justify-between gap-3">
          <span className="flex flex-col gap-2">
            <span className="flex items-center gap-3 text-3xl font-bold text-primary lg:text-4xl">
              <Link2 className="size-7 lg:size-8" aria-hidden="true" /> {t.chain.title}
            </span>
            <span className="max-w-[40ch] text-base text-muted-foreground">
              {t.chain.about}
            </span>
          </span>
          <WordChainWeekBadge />
        </span>
        {/* how a game goes, drawn with the pieces of the game */}
        <span className="flex flex-1 items-center justify-center py-2">
          <span className="w-full max-w-md">
            <WordChainPreview />
          </span>
        </span>
        {/* the facts spread over one row, the same space between them and at both ends, as wide as the Play button under them */}
        <span className="flex flex-col gap-6 text-muted-foreground">
          <span className="flex flex-wrap justify-evenly gap-x-4 gap-y-2">
            {factsOf(t.chain.facts, [Timer, Zap, Trophy]).map((fact) => (
              <Fact key={fact.label} {...fact} />
            ))}
          </span>
          <Play label={t.play} className="w-full justify-center" />
        </span>
      </button>

      {side(
        'rain',
        1,
        CloudRain,
        t.rain.title,
        t.rain.about,
        factsOf(t.rain.facts, [Timer, User]),
        <RainPreview />,
        // the preview stands on the bottom of the column, level with the bottom of the Play button
        'sm:w-56 sm:self-stretch sm:items-end',
      )}
      {side(
        'bot',
        2,
        Bot,
        t.bot.title,
        t.bot.about,
        factsOf(t.bot.facts, [Timer, Swords, Signal]),
        <BotDuelPreview />,
        'sm:w-64 sm:self-stretch sm:items-end',
      )}
    </div>
  );
};
