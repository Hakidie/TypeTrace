import { Calendar, CalendarDays, CalendarRange, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { ProfileDailyTasks } from '@/modules/profile/components/ProfileDailyTasks';
import { ProfileMonthlyChart } from '@/modules/profile/components/ProfileMonthlyChart';
import { anchorFor, periodLabel, periodOptions, periodValue } from '@/modules/profile/lib/chart-period';
import type { ChartRange } from '@/modules/profile/types/profile.types';
import { CompactToolbar } from '@/shared/components/compact-toolbar';
import { Panel } from '@/shared/components/panel';
import { dateKeyIn } from '@/shared/lib/local-date';
import { sectionTitleClass } from '@/shared/lib/panel-styles';

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: 'year', label: 'Year' },
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
];

const ICONS: Record<ChartRange, LucideIcon> = { year: Calendar, month: CalendarRange, week: CalendarDays };

/**
 * The learner's progress over time (SCRUM-240): the same chart as the profile header (average WPM and accuracy), with all its
 * axes. On the right of the title, in the look of the compact toolbar, three buttons, Year, Month and Week, each open a menu of its own periods: a click on a year, a month or a week shows it
 * (each shows the year, the month and the week of the chosen day, by itself: 2026, October, Week 2; weeks count from the 1st of the month; the one that is on is lit, the others dimmed) (the days are the learner's own, in their time zone). This year at first.
 */
export const ProgressPage = () => {
  const { data: user } = useCurrentUser();
  const today = dateKeyIn(new Date(), user?.settings?.timezone);
  const [range, setRange] = useState<ChartRange>('year');
  // The day that decides the period shown; the periods are cut from it, and never after today.
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked && picked <= today ? picked : today;

  return (
    <div className="space-y-12">
      <Panel
        title="Progress"
        bare
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
                onChange: (value) => {
                  setRange(menuRange);
                  setPicked(anchorFor(menuRange, value, date, today));
                },
              };
            })}
          />
        }
      >
        <ProfileMonthlyChart range={range} date={date} axes heightClassName="h-80" />
      </Panel>

      {/* Today's tasks under the chart (moved here from the profile; `ProfileDailyTasks` has its panel). */}
      <ProfileDailyTasks />
    </div>
  );
};
