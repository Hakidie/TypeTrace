import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { addDays, dateKeyIn, dayInWords, MONTHS } from '@/shared/lib/local-date';
import { cn } from '@/shared/lib/utils';

export interface ActivityDay {
  /** `YYYY-MM-DD`: a UTC day, or a day in the heatmap's `timeZone` when it has one. */
  date: string;
  sessions: number;
  /** The daily mission was done that day: the cell gets a mark. */
  missionCompleted?: boolean;
}

// 53 weeks, so a whole year (365 or 366 days) fits, in 4 blocks of about a quarter: the last one has the extra week.
const BLOCK_WEEKS = [13, 13, 13, 14];
/** How many days the heatmap shows, today included. Keep it equal to `HEATMAP_DAYS` in `BE/src/services/typing-session.service.ts`. */
export const HEATMAP_DAYS = BLOCK_WEEKS.reduce((total, weeks) => total + weeks, 0) * 7;

// Cells, from no activity to the most: the red of the Passages card in five steps.
const HEAT_CLASSES = ['bg-primary/10', 'bg-primary/30', 'bg-primary/50', 'bg-primary/75', 'bg-primary'];
// The mark of a day whose mission was done: a square small enough to leave the steps readable (4px, and 2px on phones,
// where a cell is about 4px wide), in the text color, and in the page color on the darkest step, where the text color of
// a light theme fades into the red: at least 3:1 on every step of Blood red, Sand and the starter themes.
const missionMarkClass = (level: number) =>
  cn('size-0.5 max-w-full sm:size-1', level === HEAT_CLASSES.length - 1 ? 'bg-background' : 'bg-foreground');

const heatLevel = (sessions: number) => {
  if (sessions <= 0) return 0;
  if (sessions === 1) return 1;
  if (sessions <= 3) return 2;
  if (sessions <= 6) return 3;
  return 4;
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

const DAY_MS = 24 * 60 * 60 * 1000;

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
  /** The line of the tooltip under the date, e.g. "2 sessions", "2 counted sessions", "Upcoming". */
  text: string;
  /** The daily mission was done that day. */
  mission: boolean;
}

interface Block {
  /** Left to right, 7 to a column; `null` is a day outside the year, drawn as an empty cell without a tooltip so the columns look full. */
  cells: (Cell | null)[];
  /** Columns, which is the width of the block. */
  weeks: number;
  label: string;
}

/** A cell of the middle step with the mission mark, for the legend and the tooltip. */
const MissionSwatch = () => (
  <span className={cn('flex size-2.5 shrink-0 items-center justify-center', HEAT_CLASSES[2])}>
    <span className={missionMarkClass(2)} />
  </span>
);

/** Under the grid: the five steps from less to more, then the mission mark. A picture only: screen readers get the `label`. */
const Legend = () => (
  <div aria-hidden className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm leading-none text-muted-foreground">
    <span className="flex items-center gap-1">
      <span>Less</span>
      {HEAT_CLASSES.map((heat) => (
        <span key={heat} data-swatch className={cn('size-2.5', heat)} />
      ))}
      <span>More</span>
    </span>
    <span className="flex items-center gap-1">
      <MissionSwatch />
      Mission done
    </span>
  </div>
);

// Pixels kept between the tooltip and the window edge, and between the tooltip and its cell.
const EDGE = 8;
const GAP = 6;

interface HeatmapTooltipProps {
  cell: Cell;
  /** Where the hovered cell is on the screen. */
  rect: DOMRect;
  isToday: boolean;
}

/**
 * The one tooltip of a heatmap, drawn in `document.body` over the hovered cell (under it when there is no room above)
 * and kept inside the window. Placed before it is painted, without animation; the mouse goes through it.
 */
const HeatmapTooltip = ({ cell, rect, isToday }: HeatmapTooltipProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const tooltip = ref.current;
    if (!tooltip) return;
    const { width, height } = tooltip.getBoundingClientRect();
    const maxLeft = document.documentElement.clientWidth - width - EDGE;
    const above = rect.top - GAP - height;
    tooltip.style.left = `${Math.max(EDGE, Math.min(rect.left + rect.width / 2 - width / 2, maxLeft))}px`;
    tooltip.style.top = `${above >= EDGE ? above : rect.bottom + GAP}px`;
  }, [cell, rect]);

  return createPortal(
    // The look of the menus (`dropdown-menu.tsx`): the page background, see-through and blurred, and the panel border.
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed top-0 left-0 z-50 border border-border bg-background/75 px-2.5 py-1.5 text-sm whitespace-nowrap text-popover-foreground shadow-md backdrop-blur-xs"
    >
      <p className="font-medium text-foreground">{isToday ? `Today · ${dayInWords(cell.key)}` : dayInWords(cell.key)}</p>
      <p className="text-muted-foreground">{cell.text}</p>
      {cell.mission && (
        <p className="flex items-center gap-1.5 text-primary">
          <MissionSwatch />
          Mission done
        </p>
      )}
    </div>,
    document.body,
  );
};

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
   * days outside the year, drawn as empty cells; the days still to come look empty too (tooltip "Upcoming"). Needs the sessions of the whole year, which `HEATMAP_DAYS` covers.
   */
  calendarYear?: boolean;
  /** The IANA zone the `days` are dates in (the learner's, e.g. `Asia/Ho_Chi_Minh`): today and `since` are taken in it. Without it, UTC days. */
  timeZone?: string;
  /** What a session is called in the tooltip: "counted session" gives "2 counted sessions". Default "session". */
  unit?: string;
  /** Under the grid: "Less", the five steps, "More", and the mission mark with its name. */
  legend?: boolean;
}

/**
 * A GitHub-style grid in 4 blocks (about a quarter each), oldest on the left. By default 53 weeks of 7 days in blocks of
 * 13, 13, 13 and 14 weeks, today at the bottom right; with `calendarYear` the quarters of this year. Cells and gaps make it 61px high.
 * One tooltip follows the cell the pointer is over (one for the whole grid, not one per cell): the day in words, its
 * sessions and, on a day with `missionCompleted` (which also gets a small mark in its cell), "Mission done".
 */
export const ActivityHeatmap = ({ days, since, label, fill, labels, calendarYear, timeZone, unit = 'session', legend }: ActivityHeatmapProps) => {
  const [hovered, setHovered] = useState<{ key: string; rect: DOMRect } | null>(null);
  const open = hovered !== null;

  // The tooltip is placed once: it is hidden when the page scrolls under it.
  useEffect(() => {
    if (!open) return;
    const hide = () => setHovered(null);
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', hide, { capture: true });
  }, [open]);

  const sessionsByDay = new Map((days ?? []).map((day) => [day.date, day.sessions]));
  const missionDays = new Set((days ?? []).filter((day) => day.missionCompleted).map((day) => day.date));
  const first = since ? dateKeyIn(new Date(since), timeZone) : '';
  const todayKey = dateKeyIn(new Date(), timeZone);

  // What the tooltip says under the date.
  const describe = (key: string, sessions: number) => {
    if (key > todayKey) return 'Upcoming';
    if (!days) return 'No data yet';
    if (sessions > 0) return `${sessions} ${unit}${sessions > 1 ? 's' : ''}`;
    return `No ${unit}s`;
  };

  const cellOf = (key: string): Cell => {
    const sessions = key < first ? 0 : (sessionsByDay.get(key) ?? 0);
    return { key, level: heatLevel(sessions), text: describe(key, sessions), mission: key >= first && key <= todayKey && missionDays.has(key) };
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
        block.cells.push(time < yearStart || time > yearEnd ? null : cellOf(dayKey(new Date(time))));
      }
    }
  } else {
    const cells = Array.from({ length: HEATMAP_DAYS }, (_, index) => cellOf(addDays(todayKey, index - (HEATMAP_DAYS - 1))));
    BLOCK_WEEKS.forEach((weeks, block) => {
      const start = BLOCK_WEEKS.slice(0, block).reduce((total, w) => total + w, 0) * 7;
      const blockCells = cells.slice(start, start + weeks * 7);
      blocks.push({ cells: blockCells, weeks, label: monthsLabel(blockCells[0].key, blockCells[blockCells.length - 1].key) });
    });
  }

  // A cell shows its tooltip; a blank cell or a month name hides it; the gaps between cells keep it, so it does not blink.
  const showTooltip = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>('[data-date]');
    const key = cell?.dataset.date;
    if (cell && key) setHovered({ key, rect: cell.getBoundingClientRect() });
    else if (target.tagName === 'SPAN') setHovered(null);
  };
  const hoveredCell = hovered ? blocks.flatMap((block) => block.cells).find((cell) => cell?.key === hovered.key) : undefined;

  const grid = (
    <div
      className={cn('flex gap-1.5', fill && (legend ? 'min-h-0 flex-1' : 'h-full'))}
      role="img"
      aria-label={label}
      onMouseOver={showTooltip}
      onMouseLeave={() => setHovered(null)}
    >
      {blocks.map((block, index) => (
        // Wider by its weeks, so every cell has the same width.
        <div key={index} style={{ flexGrow: block.weeks }} className="flex min-w-0 basis-0 flex-col gap-1">
          <div className={cn('grid auto-cols-fr grid-flow-col grid-rows-7 gap-0.5', fill && 'min-h-0 flex-1')}>
            {block.cells.map((cell, cellIndex) =>
              cell ? (
                <span
                  key={cell.key}
                  data-date={cell.key}
                  className={cn(!fill && 'h-[7px]', HEAT_CLASSES[cell.level], cell.mission && 'flex items-center justify-center')}
                >
                  {cell.mission && <span data-mission className={missionMarkClass(cell.level)} />}
                </span>
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

  return (
    <>
      {legend ? (
        <div className={cn('flex flex-col gap-2', fill && 'h-full')}>
          {grid}
          <Legend />
        </div>
      ) : (
        grid
      )}
      {hoveredCell && hovered && <HeatmapTooltip cell={hoveredCell} rect={hovered.rect} isToday={hoveredCell.key === todayKey} />}
    </>
  );
};
