import { CloudRain } from 'lucide-react';
import { useState } from 'react';
import { useRainWords } from '@/modules/rain/hooks/use-rain';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { BOT_LEVELS, type BotLevel } from '../lib/practice-duel';
import type { CoachStats } from '../types/tutorial.types';
import { BotSprite } from './BotSprite';
import { PracticeDuel } from './PracticeDuel';
import { PracticeResult } from './PracticeResult';

/** One line about each bot on its card. */
const ABOUT: Record<BotLevel, string> = {
  easy: 'Ngái ngủ, gõ chậm và hay để rơi chữ. Mưa nhẹ.',
  medium: 'Gõ đều theo nhịp nhạc. Mưa vừa, chữ dài hơn.',
  hard: 'Trùm cuối: gõ nhanh, ít khi bỏ sót. Mưa dày.',
};
const LEVELS = Object.keys(BOT_LEVELS) as BotLevel[];

/**
 * The Bot duel minigame (`?mode=minigames&game=bot`, SCRUM-247): pick a level, play the browser-only rain duel against its
 * bot (`practice-duel.ts`), then see the result with Ping's tip. Unrated: nothing goes to the ranked API.
 */
export const BotDuelMode = () => {
  const words = useRainWords();
  /** The level picked (none: the picker), the round (a new one remounts the duel) and, once it ended, its numbers. */
  const [duel, setDuel] = useState<{ level: BotLevel; round: number; stats?: CoachStats } | null>(null);

  if (words.isLoading) return <LoadingState rows={2} />;
  if (words.isError) return <ErrorState error={words.error} onRetry={() => words.refetch()} />;
  if (!words.data?.words.length) return <EmptyState icon={CloudRain} title="No words to rain yet" description="Ask an admin to add words to the word bank." />;

  if (duel?.stats)
    return (
      <PracticeResult
        stats={duel.stats}
        againLabel="Chơi lại"
        nextLabel="Đổi độ khó"
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
        skipLabel="Thoát"
        onDone={(stats) => setDuel({ ...duel, stats })}
        onSkip={() => setDuel(null)}
      />
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Chọn đối thủ</h2>
        <p className="text-sm text-muted-foreground">Đấu mưa chữ với bot. Không tính điểm.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {LEVELS.map((level) => {
          const { name, label, tier } = BOT_LEVELS[level];
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
              <span className="text-xs uppercase tracking-wider text-primary">Mưa {tier}</span>
              <span className="text-sm text-muted-foreground">{ABOUT[level]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
