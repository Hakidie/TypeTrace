import { useState, type MouseEvent } from 'react';
import { cn } from '@/shared/lib/utils';

export interface ActivityDay {
  /** `YYYY-MM-DD` (UTC). */
  date: string;
  sessions: number;
}

// 53 weeks, so a whole year (365 or 366 days) fits, in 4 blocks of about a quarter: the last one has the extra week.
const BLOCK_WEEKS = [13, 13, 13, 14];
/** How many days the heatmap shows, today included. Keep it equal to `HEATMAP_DAYS` in `BE/src/services/typing-session.service.ts`. */
export const HEATMAP_DAYS = BLOCK_WEEKS.reduce((total, weeks) => total + weeks, 0) * 7;

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

const DAY_MS = 24 * 60 * 60 * 1000;

// Fixed three-letter names: `toLocaleDateString` gives "Sept" for September in some locales.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthOf = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1];

/** The months a block covers: "Nov – Jan", or just "Nov" when it stays in one. */
const monthsLabel = (firstKey: string, lastKey: string) => {
  const from = monthOf(firstKey);
  const to = monthOf(lastKey);
  return from === to ? from : `${from} – ${to}`;
};

const QUARTER_LABELS = ['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Oct – Dec'];

interface Cell {
  key: string;
  level: number;
  /** Shown in the tooltip: the day and what happened on it, e.g. "27 Oct 2026: 2 sessions". */
  tip: string;
}

/** `2026-10-27` as "27 Oct 2026". */
const formatDay = (key: string) => `${key.slice(8, 10)} ${monthOf(key)} ${key.slice(0, 4)}`;

interface Block {
  /** Left to right, 7 to a column; `null` is a day outside the year, drawn as an empty cell without a tooltip so the columns look full. */
  cells: (Cell | null)[];
  /** Columns, which is the width of the block. */
  weeks: number;
  label: string;
}

interface ActivityHeatmapProps {
  /** Sessions per day. Without it every cell is empty and says "no data yet". */
  days?: ActivityDay[];
  /** Days before this date count as no activity. */
  since?: string;
  /** Accessible name, e.g. "Completed sessions in the last 371 days". */
  label: string;
  /** Fill the height of the parent (the rows share it) instead of the 61px of 7px cells. */
  fill?: boolean;
  /** Under each block, the months it covers, e.g. "Nov – Jan". */
  labels?: boolean;
  /**
   * The current calendar year instead of the last 371 days: whole weeks (Monday on top) from the one of 1 January to the
   * one of 31 December, cut into four blocks, one per quarter (Jan – Mar, ...). Only the first and the last column can have
   * days outside the year, drawn as empty cells; the days still to come look empty too (tooltip "upcoming"). Needs the sessions of the whole year, which `HEATMAP_DAYS` covers.
   */
  calendarYear?: boolean;
}

/**
 * A GitHub-style grid in 4 blocks (about a quarter each), oldest on the left. By default 53 weeks of 7 days in blocks of
 * 13, 13, 13 and 14 weeks, today at the bottom right; with `calendarYear` the quarters of this year. Cells and gaps make it 61px high.
 */
export const ActivityHeatmap = ({ days, since, label, fill, labels, calendarYear }: ActivityHeatmapProps) => {
  const sessionsByDay = new Map((days ?? []).map((day) => [day.date, day.sessions]));
  const first = since ? dayKey(new Date(since)) : '';
  const today = new Date();
  const todayKey = dayKey(today);

  const cellOf = (key: string): Cell => {
    const sessions = key < first ? 0 : (sessionsByDay.get(key) ?? 0);
    const text = days ? (sessions > 0 ? `${sessions} session${sessions > 1 ? 's' : ''}` : 'no activity') : 'no data yet';
    return { key, level: heatLevel(sessions), tip: `${formatDay(key)}: ${text}` };
  };

  const blocks: Block[] = [];
  if (calendarYear) {
    // One run of whole weeks (Monday to Sunday) from the week of 1 January to the week of 31 December, cut into the four
    // quarters. A week goes to the quarter its Monday is in (the first week to the first quarter), so the columns stay full
    // and only the days outside the year are blank.
    const year = Number(todayKey.slice(0, 4));
    const yearStart = Date.UTC(year, 0, 1);
    const yearEnd = Date.UTC(year, 11, 31);
    const firstMonday = yearStart - ((new Date(yearStart).getUTCDay() + 6) % 7) * DAY_MS;
    const weeks = Math.ceil(((yearEnd - firstMonday) / DAY_MS + 1) / 7);
    QUARTER_LABELS.forEach((quarterLabel) => blocks.push({ cells: [], weeks: 0, label: quarterLabel }));
    for (let week = 0; week < weeks; week += 1) {
      const monday = firstMonday + week * 7 * DAY_MS;
      const block = blocks[Math.floor(new Date(Math.max(monday, yearStart)).getUTCMonth() / 3)];
      block.weeks += 1;
      for (let day = 0; day < 7; day += 1) {
        const time = monday + day * DAY_MS;
        if (time < yearStart || time > yearEnd) {
          block.cells.push(null);
          continue;
        }
        const key = dayKey(new Date(time));
        block.cells.push(key > todayKey ? { ...cellOf(key), tip: `${formatDay(key)}: upcoming` } : cellOf(key));
      }
    }
  } else {
    const cells = Array.from({ length: HEATMAP_DAYS }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (HEATMAP_DAYS - 1 - index));
      return cellOf(dayKey(date));
    });
    BLOCK_WEEKS.forEach((weeks, block) => {
      const start = BLOCK_WEEKS.slice(0, block).reduce((total, w) => total + w, 0) * 7;
      const blockCells = cells.slice(start, start + weeks * 7);
      blocks.push({ cells: blockCells, weeks, label: monthsLabel(blockCells[0].key, blockCells[blockCells.length - 1].key) });
    });
  }

  // The tooltip follows the cell the pointer is over (one for the whole grid, not one per cell), above it, at once. It looks like a dropdown menu: see-through page background with blur, panel border, muted text.
  const [tip, setTip] = useState<{ text: string; left: number; top: number }>();
  const showTip = (event: MouseEvent<HTMLDivElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (!cell) return setTip(undefined);
    const box = cell.getBoundingClientRect();
    const grid = event.currentTarget.getBoundingClientRect();
    setTip({ text: cell.dataset.tip ?? '', left: box.left - grid.left + box.width / 2, top: box.top - grid.top });
  };

  return (
    <div
      className={cn('relative flex gap-1.5', fill && 'h-full')}
      role="img"
      aria-label={label}
      onMouseOver={showTip}
      onMouseLeave={() => setTip(undefined)}
    >
      {tip && (
        <span
          style={{ left: tip.left, top: tip.top }}
          className="pointer-events-none absolute z-10 -mt-1 -translate-x-1/2 -translate-y-full whitespace-nowrap border border-border bg-background/75 px-3 py-1.5 text-base text-muted-foreground shadow-md backdrop-blur-xs"
        >
          {tip.text}
        </span>
      )}
      {blocks.map((block, index) => (
        // Wider by its weeks, so every cell has the same width.
        <div key={index} style={{ flexGrow: block.weeks }} className="flex min-w-0 basis-0 flex-col gap-1">
          <div className={cn('grid auto-cols-fr grid-flow-col grid-rows-7 gap-0.5', fill && 'min-h-0 flex-1')}>
            {block.cells.map((cell, cellIndex) =>
              cell ? (
                <span
                  key={cell.key}
                  data-tip={cell.tip}
                  className={cn(!fill && 'h-[7px]', HEAT_CLASSES[cell.level])}
                />
              ) : (
                <span key={`blank-${cellIndex}`} aria-hidden className={cn(!fill && 'h-[7px]', HEAT_CLASSES[0])} />
              ),
            )}
          </div>
          {labels && <span className="truncate text-sm leading-none text-muted-foreground">{block.label}</span>}
        </div>
      ))}
    </div>
  );
};
