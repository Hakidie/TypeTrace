import { Calendar, CalendarDays, CalendarRange, ChartLine, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { ProfileErrorProfile } from '@/modules/profile/components/ProfileErrorProfile';
import { ProfileSessions } from '@/modules/profile/components/ProfileSessions';
import { ProfileMonthlyChart } from '@/modules/profile/components/ProfileMonthlyChart';
import { anchorFor, compareLabel, periodLabel, periodOptions, periodValue, previousMonthStart } from '@/modules/profile/lib/chart-period';
import { COMPARE_OPACITIES } from '@/modules/profile/lib/monthly-chart';
import type { ChartLines, ChartRange } from '@/modules/profile/types/profile.types';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { Panel } from '@/shared/components/panel';
import { PanelTitleSwitch } from '@/shared/components/panel-title-switch';
import { dateKeyIn } from '@/shared/lib/local-date';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { VowelToneGrid } from '../components/VowelToneGrid';

// Week, Month, Year: the smallest first.
const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

/** How long a range is, to tell which ones are as long as the one on the chart or longer. */
const RANGE_LENGTH: Record<ChartRange, number> = { week: 0, month: 1, year: 2 };

const ICONS: Record<ChartRange, LucideIcon> = {
  year: Calendar,
  month: CalendarRange,
  week: CalendarDays,
};

const LINES_OPTIONS: { value: ChartLines; label: string }[] = [
  { value: 'all', label: 'All lines' },
  { value: 'wpm', label: 'WPM only' },
  { value: 'accuracy', label: 'Accuracy only' },
];

/** A week, month or year put on the chart next to the one it shows. */
interface AddedPeriod {
  range: ChartRange;
  /** A day that holds it. */
  anchor: string;
}

const idOf = ({ range, anchor }: AddedPeriod) => `${range}:${periodValue(range, anchor)}`;

/**
 * The learner's progress over time (SCRUM-240): the same chart as the profile header (average WPM and accuracy), with all its
 * axes. On the right of the title, in the look of the compact toolbar, three buttons, Week, Month and Year, each open a menu of its own periods: a click on a week, a month or a year shows it
 * (each shows the week, the month and the year of the chosen day, by itself: Week 2, October, 2026; weeks count from the 1st of the month; the one that is on is lit, the others dimmed) (the days are the learner's own, in their time zone).
 * The month before this one at first. Under the chart, at the left: the tags of what was added, then + Add comparison (it opens a menu of Year, Month and Week (only the ranges as long as the one on the chart or longer: on a month, Year and Month); each row says what it is set to (the current year and month at first: Year 2026, Month March, Week Week 2) and opens a second menu beside it to pick the year, the month (January to December of that year) or the week (of that month) to add to the chart; a pick also sets the rows (up to three), each as a tag, e.g. "Week 1 October 2025", with an x to take it away: their lines are drawn on the same chart,  fainter, column by column), and, at the right, the Lines button, which picks what the chart draws: all lines, only the WPM or only the accuracy.
 */
export const ProgressPage = () => {
  const { data: user } = useCurrentUser();
  const today = dateKeyIn(new Date(), user?.settings?.timezone);
  const [range, setRange] = useState<ChartRange>('month');
  // The two pages: Progress (the chart and the panel under it) or the vowel × tone grid (SCRUM-29), switched by the button under the page.
  const [view, setView] = useState<'progress' | 'vowel-tone'>('progress');
  // The panel under the chart: the error profile (first) or My Sessions, switched by clicking its title.
  const [bottomPanel, setBottomPanel] = useState<'sessions' | 'errors'>('errors');
  // The day that decides the period shown (the month before this one at first); the periods are cut from it, and never after today.
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked && picked <= today ? picked : previousMonthStart(today);
  // The periods put on the chart next to it, in the order they were added.
  const [added, setAdded] = useState<AddedPeriod[]>([]);
  // Which lines show: both, only the WPM or only the accuracy.
  const [lines, setLines] = useState<ChartLines>('all');

  // What the menu of the + is set to: the year whose months it lists, the month whose weeks it lists. The current year and month at first;
  // picking a year, a month or a week in it also sets it.
  const [menuDay, setMenuDay] = useState<string | null>(null);
  const inMenu = menuDay && menuDay <= today ? menuDay : today;

  const pickAdded = (periodRange: ChartRange, value: string) => {
    const anchor = anchorFor(periodRange, value, inMenu, today);
    setMenuDay(anchor);
    const id = `${periodRange}:${value}`;
    if (added.some((period) => idOf(period) === id)) setAdded(added.filter((period) => idOf(period) !== id));
    else if (added.length < COMPARE_OPACITIES.length) setAdded([...added, { range: periodRange, anchor }]);
  };

  // The grid is a page of its own: only its panel, and the button back under it (12px under, as on the Passages page).
  if (view === 'vowel-tone') {
    return (
      <div className="flex flex-1 flex-col">
        <VowelToneGrid />
        <div className="mt-3 mb-4 flex shrink-0 items-center justify-center">
          <PanelTitleSwitch other="Progress" showLabel onClick={() => setView('progress')} />
        </div>
      </div>
    );
  }

  return (
    // On a large screen the page is as tall as the screen leaves it (`flex-1` in the page's column): the chart takes the height the
    // error profile and the button leave, at least `min-h-64`, and the page scrolls only when even that does not fit.
    <div className="flex flex-1 flex-col gap-12">
      {/* PANEL Progress */}
      <Panel
        title="Progress"
        bare
        fill
        titleClassName={sectionTitleClass}
        actions={
          <CompactToolbar
            menus={RANGE_OPTIONS.map(({ value: menuRange, label }) => {
              const active = menuRange === range;
              return {
                label,
                icon: ICONS[menuRange],
                // Each button shows the year, the month and the week of the chosen day: '2026', 'Mar 2026', '9 Mar – 15 Mar'.
                valueLabel: periodLabel(menuRange, date),
                active,
                options: periodOptions(menuRange, date, today),
                value: active ? periodValue(range, date) : '',
                onChange: (value: string) => {
                  setRange(menuRange);
                  setPicked(anchorFor(menuRange, value, date, today));
                },
              };
            })}
          />
        }
      >
        {/* The chart is laid out inside a box that grows (`lg:flex-1`), so it has a definite height to fill. */}
        <div className="relative h-80 lg:h-auto lg:min-h-64 lg:flex-1">
          <div className="absolute inset-0">
            <ProfileMonthlyChart
              range={range}
              date={date}
              compare={added.map(({ range: periodRange, anchor }) => ({
                range: periodRange,
                date: anchor,
              }))}
              axes
              lines={lines}
              heightClassName="h-full"
            />
          </div>
        </div>

        {/* Under the chart: the periods put on it at the left (the tags, then the + Add comparison), which lines it draws at the right. */}
        <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <CompactToolbar
            className="sm:justify-start [&>:first-child]:pl-0"
            adder={{
              label: 'Add comparison',
              disabled: added.length >= COMPARE_OPACITIES.length,
              // Only the ranges as long as the one on the chart or longer: a year or a month on a month, never a week.
              groups: RANGE_OPTIONS.filter(({ value: groupRange }) => RANGE_LENGTH[groupRange] >= RANGE_LENGTH[range]).map(({ value: groupRange, label }) => ({
                label,
                // The year (2026), the month (March) and the week (Week 2) the menu is set to; its months are the ones of that year, its weeks the ones of that month.
                valueLabel: periodLabel(groupRange, inMenu),
                options: periodOptions(groupRange, inMenu, today),
                selected: added.filter((period) => period.range === groupRange).map((period) => periodValue(groupRange, period.anchor)),
                onPick: (value) => pickAdded(groupRange, value),
              })),
            }}
            tags={added.map((period, index) => ({
              id: idOf(period),
              label: compareLabel(period.range, period.anchor),
              sample: (
                <svg width="24" height="4" aria-hidden className="shrink-0">
                  {/* The line of the figure that shows: the WPM, solid, unless only the accuracy does, dashed. */}
                  <line
                    x1="0"
                    x2="24"
                    y1="2"
                    y2="2"
                    stroke={lines === 'accuracy' ? 'var(--muted-foreground)' : 'var(--primary)'}
                    strokeDasharray={lines === 'accuracy' ? '4 3' : undefined}
                    strokeWidth="2"
                    strokeOpacity={COMPARE_OPACITIES[index]}
                  />
                </svg>
              ),
              onRemove: () => setAdded(added.filter((other) => idOf(other) !== idOf(period))),
            }))}
          />
          <CompactToolbar
            menus={[
              {
                label: 'Lines',
                icon: ChartLine,
                valueLabel: LINES_OPTIONS.find((option) => option.value === lines)!.label,
                options: LINES_OPTIONS,
                value: lines,
                onChange: (value: string) => setLines(value as ChartLines),
              },
            ]}
          />
        </div>
      </Panel>

      {/* One place for two panels: the title of each switches to the other (the error profile first). */}
      {bottomPanel === 'errors' ? (
        <ProfileErrorProfile onSwitch={() => setBottomPanel('sessions')} />
      ) : (
        <ProfileSessions onSwitch={() => setBottomPanel('errors')} />
      )}

      {/* `mb-4` and the 32px of the page make 48px under the button, as many as between the header and the title (`pt-12`). */}
      <div className="mb-4 flex shrink-0 items-center justify-center">
        <PanelTitleSwitch other="Vowel × tone" showLabel onClick={() => setView('vowel-tone')} />
      </div>
    </div>
  );
};
