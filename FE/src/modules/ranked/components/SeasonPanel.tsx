import type { ReactNode } from 'react';
import { Panel } from '@/shared/components/panel';
import { MONTHS } from '@/shared/lib/local-date';
import { cn } from '@/shared/lib/utils';

/** The days a season runs, e.g. `{ from: '1 Oct 2026', to: '31 Dec 2026' }`; `undefined` when the dates are missing. */
const seasonDays = ({ startsAt, endsAt }: { startsAt: string; endsAt: string }) => {
  const [start, end] = [new Date(startsAt), new Date(endsAt)];
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
  const day = (date: Date) => `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  return { from: day(start), to: day(end) };
};

interface SeasonPanelProps {
  number: number;
  startsAt: string;
  /** The last day shown: the season's end, or the day an admin closed it. */
  endsAt: string;
  /** Before the name, e.g. the icon of the mode in play. */
  lead?: ReactNode;
  /** After the dates, in the left group: buttons that show while the panel is hovered (it has the `group` class). */
  actions?: ReactNode;
  /** The big line at the top of the right column, e.g. the tier or the mode. */
  headline: ReactNode;
  /** The smaller line under it, e.g. the wins, losses and draws. */
  subline: ReactNode;
  /** The big figure at the right edge, e.g. the rating or the status of the season. */
  value: ReactNode;
  valueClassName?: string;
  valueLabel?: string;
  /** At the very end, e.g. a button for this season. */
  trailing?: ReactNode;
  className?: string;
}

/**
 * The season bar of the Rank lobby, also the row of the admin seasons page: the name of the season in capitals with its
 * days beside it, then two lines (headline and subline) and one big figure on the right.
 */
export const SeasonPanel = ({
  number,
  startsAt,
  endsAt,
  lead,
  actions,
  headline,
  subline,
  value,
  valueClassName,
  valueLabel,
  trailing,
  className,
}: SeasonPanelProps) => {
  const days = seasonDays({ startsAt, endsAt });
  return (
    <article className={cn('group', className)}>
      {/* PANEL Season */}
      <Panel className="flex items-center gap-6 text-primary">
        <div className="mr-auto flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          {lead}
          <span className="text-[3.25rem] font-black uppercase leading-none">Season {number}</span>
          {/* 2.3rem = the height of the capitals of SEASON (0.7 of its 3.25rem), so FROM sits at their top and TO on their baseline. */}
          {days && (
            <div className="flex h-[2.3rem] flex-col items-start justify-between text-base leading-none text-muted-foreground">
              <span>FROM {days.from}</span>
              <span>TO {days.to}</span>
            </div>
          )}
          {actions}
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="flex items-center gap-2 text-2xl font-semibold leading-none">{headline}</span>
          <span className="text-xl leading-none text-muted-foreground tabular-nums">{subline}</span>
        </div>
        <span className={cn('text-[3.25rem] font-black leading-none tabular-nums', valueClassName)} aria-label={valueLabel}>
          {value}
        </span>
        {trailing}
      </Panel>
    </article>
  );
};
