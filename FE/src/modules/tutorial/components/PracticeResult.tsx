import { Button } from '@/shared/components/ui/button';
import { useCoachTip } from '../hooks/use-tutorial';
import type { CoachStats } from '../types/tutorial.types';
import { Ping } from './Ping';

/** The texts of the result: English (the tutorial's, and the Bot duel's by default) or Vietnamese (the Bot duel, when the player chose it). */
const TEXT = {
  en: {
    headings: { win: 'You win', loss: 'You lose', draw: 'Draw' },
    labels: ['words typed', 'lives left', 'words thrown'],
    thinking: 'Ping đang nghĩ…',
  },
  vi: {
    headings: { win: 'Bạn thắng', loss: 'Bạn thua', draw: 'Hòa' },
    labels: ['từ đã gõ', 'mạng còn lại', 'từ đã ném'],
    thinking: 'Ping đang nghĩ…',
  },
} as const;

/** Shown when the AI and the backend both cannot answer (offline): Ping still says something. */
const OFFLINE_TIP = 'Trận hay đó! Gõ chữ ở thấp nhất trước, chữ dài để sau. Sẵn sàng thì vào Rank thật nhé!';

interface PracticeResultProps {
  stats: CoachStats;
  onAgain: () => void;
  onRank: () => void;
  /** The two buttons: the tutorial plays Ping again or goes to Rank; the Bot duel plays again or changes level. */
  againLabel?: string;
  nextLabel?: string;
  /** The language of the headings and numbers' labels (the tutorial leaves it in English). */
  lang?: 'en' | 'vi';
}

/** After the practice duel: the numbers, and Ping's tip written from them (AI, or a written one). */
export const PracticeResult = ({ stats, onAgain, onRank, againLabel = 'Đấu lại với Ping', nextLabel = 'Vào Rank thật', lang = 'en' }: PracticeResultProps) => {
  const text = TEXT[lang];
  const { data, isError } = useCoachTip(stats);
  const tip = data?.tip ?? (isError ? OFFLINE_TIP : undefined);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 text-primary">
      <h2 className="text-center text-5xl font-black uppercase">{text.headings[stats.result]}</h2>
      <div className="grid grid-cols-3 gap-3 text-center text-foreground">
        {[
          [stats.hits, text.labels[0]],
          [stats.livesLeft, text.labels[1]],
          [stats.thrown, text.labels[2]],
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
          {tip ?? text.thinking}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onAgain}>
          {againLabel}
        </Button>
        <Button onClick={onRank}>{nextLabel}</Button>
      </div>
    </div>
  );
};
