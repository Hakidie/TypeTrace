import { Button } from '@/shared/components/ui/button';
import { useCoachTip } from '../hooks/use-tutorial';
import type { CoachStats } from '../types/tutorial.types';
import { Ping } from './Ping';

const HEADINGS = { win: 'You win', loss: 'You lose', draw: 'Draw' } as const;

/** Shown when the AI and the backend both cannot answer (offline): Ping still says something. */
const OFFLINE_TIP = 'Trận hay đó! Gõ chữ ở thấp nhất trước, chữ dài để sau. Sẵn sàng thì vào Rank thật nhé!';

interface PracticeResultProps {
  stats: CoachStats;
  onAgain: () => void;
  onRank: () => void;
}

/** After the practice duel: the numbers, and Ping's tip written from them (AI, or a written one). */
export const PracticeResult = ({ stats, onAgain, onRank }: PracticeResultProps) => {
  const { data, isError } = useCoachTip(stats);
  const tip = data?.tip ?? (isError ? OFFLINE_TIP : undefined);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 text-primary">
      <h2 className="text-center text-5xl font-black uppercase">{HEADINGS[stats.result]}</h2>
      <div className="grid grid-cols-3 gap-3 text-center text-foreground">
        {[
          [stats.hits, 'words typed'],
          [stats.livesLeft, 'lives left'],
          [stats.thrown, 'words thrown'],
        ].map(([value, label]) => (
          <div key={label} className="border bg-card/60 px-3 py-4 backdrop-blur-sm">
            <p className="text-3xl font-black tabular-nums">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-3">
        <Ping move={stats.result === 'loss' ? 'sad' : 'happy'} size={2} className="hidden sm:block" />
        <Ping move={stats.result === 'loss' ? 'sad' : 'happy'} className="sm:hidden" />
        <div role="status" className="min-w-0 flex-1 border bg-background/85 p-4 text-sm leading-relaxed text-foreground backdrop-blur-sm">
          <span className="font-semibold text-primary">Ping: </span>
          {tip ?? 'Ping đang nghĩ…'}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onAgain}>
          Đấu lại với Ping
        </Button>
        <Button onClick={onRank}>Vào Rank thật</Button>
      </div>
    </div>
  );
};
