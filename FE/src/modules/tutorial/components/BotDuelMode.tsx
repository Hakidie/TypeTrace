import { CloudRain, Languages } from 'lucide-react';
import { useState } from 'react';
import { useRainWords } from '@/modules/rain/hooks/use-rain';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Button } from '@/shared/components/ui/button';
import { useMinigameLang, type MinigameLang } from '@/shared/hooks/use-minigame-lang';
import { BOT_LEVELS, type BotLevel } from '../lib/practice-duel';
import type { CoachStats } from '../types/tutorial.types';
import { BotSprite } from './BotSprite';
import { PracticeDuel } from './PracticeDuel';
import { PracticeResult } from './PracticeResult';

/** The texts of the picker and of the buttons around a duel, in each language. */
const TEXT: Record<
  MinigameLang,
  {
    switchTo: string;
    pick: string;
    intro: string;
    rain: (tier: string) => string;
    levels: Record<BotLevel, { label: string; about: string }>;
    again: string;
    change: string;
    leave: string;
  }
> = {
  en: {
    switchTo: 'Tiếng Việt',
    pick: 'Pick your opponent',
    intro: 'Word rain against a bot. No points.',
    rain: (tier) => `${tier} rain`,
    levels: {
      easy: { label: 'Easy', about: 'Sleepy, types slowly and drops words. Light rain.' },
      medium: { label: 'Medium', about: 'Types steadily to the beat. Steady rain, longer words.' },
      hard: { label: 'Hard', about: 'The final boss: types fast and rarely misses. Heavy rain.' },
    },
    again: 'Play again',
    change: 'Change level',
    leave: 'Leave',
  },
  vi: {
    switchTo: 'English',
    pick: 'Chọn đối thủ',
    intro: 'Đấu mưa chữ với bot. Không tính điểm.',
    rain: (tier) => `Mưa ${tier}`,
    levels: {
      easy: { label: 'Dễ', about: 'Ngái ngủ, gõ chậm và hay để rơi chữ. Mưa nhẹ.' },
      medium: { label: 'Vừa', about: 'Gõ đều theo nhịp nhạc. Mưa vừa, chữ dài hơn.' },
      hard: { label: 'Khó', about: 'Trùm cuối: gõ nhanh, ít khi bỏ sót. Mưa dày.' },
    },
    again: 'Chơi lại',
    change: 'Đổi độ khó',
    leave: 'Thoát',
  },
};
const LEVELS = Object.keys(BOT_LEVELS) as BotLevel[];

/**
 * The Bot duel minigame (`?mode=minigames&game=bot`, SCRUM-247): pick a level, play the browser-only rain duel against its
 * bot (`practice-duel.ts`), then see the result with Ping's tip. Unrated: nothing goes to the ranked API.
 */
export const BotDuelMode = () => {
  const words = useRainWords();
  const { lang, toggle } = useMinigameLang();
  const t = TEXT[lang];
  /** The level picked (none: the picker), the round (a new one remounts the duel) and, once it ended, its numbers. */
  const [duel, setDuel] = useState<{ level: BotLevel; round: number; stats?: CoachStats } | null>(null);

  if (words.isLoading) return <LoadingState rows={2} />;
  if (words.isError) return <ErrorState error={words.error} onRetry={() => words.refetch()} />;
  if (!words.data?.words.length) return <EmptyState icon={CloudRain} title="No words to rain yet" description="Ask an admin to add words to the word bank." />;

  if (duel?.stats)
    return (
      <PracticeResult
        stats={duel.stats}
        lang={lang}
        againLabel={t.again}
        nextLabel={t.change}
        onAgain={() => setDuel({ level: duel.level, round: duel.round + 1 })}
        onRank={() => setDuel(null)}
      />
    );
  if (duel)
    return (
      <PracticeDuel
        key={duel.round}
        words={words.data.words}
        level={duel.level}
        skipLabel={t.leave}
        onDone={(stats) => setDuel({ ...duel, stats })}
        onSkip={() => setDuel(null)}
      />
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-6">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-primary">{t.pick}</h2>
        <p className="text-base text-muted-foreground">{t.intro}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {LEVELS.map((level) => {
          const { name, tier } = BOT_LEVELS[level];
          const { label, about } = t.levels[level];
          return (
            <button
              key={level}
              type="button"
              onClick={() => setDuel({ level, round: 1 })}
              className="group flex cursor-pointer flex-col items-center gap-3 border border-primary/20 bg-background/40 p-5 text-center backdrop-blur-sm transition-colors hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-lg font-bold">
                {name} · {label}
              </span>
              <BotSprite level={level} move="idle" size={2} />
              <span className="text-base uppercase tracking-wider text-primary">{t.rain(tier)}</span>
              <span className="text-base text-muted-foreground">{about}</span>
            </button>
          );
        })}
      </div>
      {/* the language of the texts, under the cards */}
      <div className="flex justify-center">
        <Button type="button" variant="ghost" onClick={toggle} className="h-8 gap-1.5 px-2 text-sm text-muted-foreground hover:bg-primary hover:text-primary-foreground">
          <Languages className="size-4" aria-hidden="true" /> {t.switchTo}
        </Button>
      </div>
    </div>
  );
};
