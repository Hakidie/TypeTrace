import { cn } from '@/shared/lib/utils';

export interface ActivityDay {
  /** `YYYY-MM-DD` (UTC). */
  date: string;
  sessions: number;
}

const BLOCKS = 4;
const WEEKS_PER_BLOCK = 13;
const BLOCK_DAYS = WEEKS_PER_BLOCK * 7;
/** How many days the heatmap shows, today included. Keep it equal to `HEATMAP_DAYS` in `BE/src/services/typing-session.service.ts`. */
export const HEATMAP_DAYS = BLOCKS * BLOCK_DAYS;

// Cells, from no activity to the most: the red of the Passages card in five steps.
const HEAT_CLASSES = ['bg-primary/10', 'bg-primary/30', 'bg-primary/50', 'bg-primary/75', 'bg-primary'];

const heatLevel = (sessions: number) => {
  if (sessions <= 0) return 0;
  if (sessions === 1) return 1;
  if (sessions <= 3) return 2;
  if (sessions <= 6) return 3;
  return 4;
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

interface ActivityHeatmapProps {
  /** Sessions per day. Without it every cell is empty and says "no data yet". */
  days?: ActivityDay[];
  /** Days before this date count as no activity. */
  since?: string;
  /** Accessible name, e.g. "Completed sessions in the last 364 days". */
  label: string;
}

/** A GitHub-style grid: 52 weeks of 7 days in 4 blocks of 13 weeks (about a quarter each), oldest on the left, today at the bottom right. Cells and gaps make it 61px high. */
export const ActivityHeatmap = ({ days, since, label }: ActivityHeatmapProps) => {
  const sessionsByDay = new Map((days ?? []).map((day) => [day.date, day.sessions]));
  const first = since ? dayKey(new Date(since)) : '';
  const today = new Date();

  const cells = Array.from({ length: HEATMAP_DAYS }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (HEATMAP_DAYS - 1 - index));
    const key = dayKey(date);
    const sessions = key < first ? 0 : (sessionsByDay.get(key) ?? 0);
    const text = days ? (sessions > 0 ? `${sessions} session${sessions > 1 ? 's' : ''}` : 'no activity') : 'no data yet';
    return { key, level: heatLevel(sessions), title: `${key}: ${text}` };
  });

  return (
    <div className="flex gap-1.5" role="img" aria-label={label}>
      {Array.from({ length: BLOCKS }, (_, block) => (
        <div key={block} className="grid flex-1 auto-cols-fr grid-flow-col grid-rows-7 gap-0.5">
          {cells.slice(block * BLOCK_DAYS, (block + 1) * BLOCK_DAYS).map((cell) => (
            <span key={cell.key} title={cell.title} className={cn('h-[7px]', HEAT_CLASSES[cell.level])} />
          ))}
        </div>
      ))}
    </div>
  );
};
