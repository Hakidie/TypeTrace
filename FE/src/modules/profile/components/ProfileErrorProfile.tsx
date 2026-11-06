import type { ReactElement } from 'react';
import { CircleCheck, Minus, TrendingDown, TrendingUp, TriangleAlert, type LucideIcon } from 'lucide-react';
import { ERROR_CHANCE_WORDS } from '@/modules/daily-tasks/daily-tasks.config';
import { errorLabels } from '@/modules/typing/typing.config';
import { getApiErrorMessage } from '@/shared/api/api-error';
import { LabeledTag } from '@/shared/components/labeled-tag';
import { Panel } from '@/shared/components/panel';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { WordErrorType } from '@/shared/lib/vietnamese-errors';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { cn } from '@/shared/lib/utils';
import { useErrorProfile } from '../hooks/use-profile';
import type { ErrorProfile, ErrorTrend, ErrorTypeProfile } from '../types/profile.types';

const linkClass = 'text-primary underline-offset-4 hover:underline';
// One column on phones, two from `md`, three from `lg`, like the daily tasks. `grid-cols-1` keeps the phone column at the
// width of the screen.
const gridClass = 'grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3';
// Blank error types while the profile loads: a row of them on wide screens.
const BLANK_TYPES = 3;
// The focus ring of the hints reached with the keyboard, as on the tags.
const hintFocusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** The words and the icon of each trend: the error rate going down is the learner getting better. */
const TREND_INFO: Record<Exclude<ErrorTrend, 'insufficient_data'>, { label: string; icon: LucideIcon; className: string }> = {
  improved: { label: 'Improving', icon: TrendingDown, className: 'text-primary' },
  worse: { label: 'Getting worse', icon: TrendingUp, className: 'text-destructive' },
  unchanged: { label: 'Steady', icon: Minus, className: 'text-muted-foreground' },
};

/** The words that give a chance of an error type: "words with đ", or "words" where every word does. */
const chanceWords = (type: WordErrorType) => ERROR_CHANCE_WORDS[type] ?? 'words';

/** "12 more words with đ", "1 more word": what a type still needs for a level. */
const missingWords = (type: WordErrorType, missing: number) =>
  `${missing} more ${missing === 1 ? chanceWords(type).replace(/^words/, 'word') : chanceWords(type)}`;

/** A hint on hover or keyboard focus, in the shared tooltip. */
const Hint = ({ text, children }: { text: string; children: ReactElement }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

interface ItemProps {
  item: ErrorTypeProfile;
  profile: ErrorProfile;
}

/** Weak (a red tag), OK, or what the type still needs before it has a level. */
const LevelMark = ({ item, profile }: ItemProps) => {
  if (item.level === 'weak') {
    return <LabeledTag icon={TriangleAlert} text="Weak" hint={`Wrong in ${profile.weakRate}% or more of the ${chanceWords(item.type)}`} />;
  }
  if (item.level === 'ok') {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <CircleCheck className="size-4" aria-hidden />
        OK
      </span>
    );
  }
  return <span className="text-muted-foreground">Needs {missingWords(item.type, profile.minOpportunities - item.opportunities)}</span>;
};

/** The trend against the sessions before, its rates in a tooltip. A type without a level has none: the level says what it needs. */
const TrendMark = ({ item, profile }: ItemProps) => {
  if (item.level === 'insufficient_data') return null;
  if (item.trend === 'insufficient_data') {
    return (
      <Hint text={`A trend needs ${profile.minOpportunities} ${chanceWords(item.type)} in the ${profile.window} sessions before too`}>
        <span tabIndex={0} className={cn('text-muted-foreground', hintFocusClass)}>
          No trend yet
        </span>
      </Hint>
    );
  }
  const { label, icon: Icon, className } = TREND_INFO[item.trend];
  return (
    <Hint text={`${item.previousRate}% → ${item.rate}% against the ${profile.window} sessions before`}>
      <span tabIndex={0} className={cn('inline-flex items-center gap-1.5', className, hintFocusClass)}>
        <Icon className="size-4" aria-hidden />
        {label}
      </span>
    </Hint>
  );
};

/**
 * One error type: its name and error rate (a dash before it has a level), a bar of the rate that runs to twice the weak
 * line, so the line (the mark) is in its middle, then the level and the trend. The bar and the line under it are pushed to
 * the bottom of the item, so the bars of a row line up when a long name takes two lines.
 */
const ErrorTypeItem = ({ item, profile }: ItemProps) => {
  const hasLevel = item.level !== 'insufficient_data';
  const filled = hasLevel ? Math.min(item.rate / (profile.weakRate * 2), 1) * 100 : 0;

  return (
    <li className="-mr-3 -ml-4 flex flex-col gap-3 py-3 pr-3 pl-4 transition-colors hover:bg-primary/15">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-xl font-extrabold text-primary/80">{errorLabels[item.type]}</p>
        <p className={cn('shrink-0 text-xl font-extrabold tabular-nums', hasLevel ? 'text-primary' : 'text-muted-foreground')}>
          {hasLevel ? `${item.rate}%` : '—'}
        </p>
      </div>
      <div className="mt-auto space-y-3">
        <div className="relative h-2 bg-muted" aria-hidden>
          <div className={cn('h-full', item.level === 'weak' ? 'bg-primary' : 'bg-primary/40')} style={{ width: `${filled}%` }} />
          <div className="absolute -inset-y-1 left-1/2 w-0.5 bg-foreground/40" />
        </div>
        <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-base">
          <LevelMark item={item} profile={profile} />
          <TrendMark item={item} profile={profile} />
        </div>
      </div>
    </li>
  );
};

/**
 * The learner's error profile (SCRUM-27), under the heatmap and without a frame: each error type of their last counted
 * sessions with its error rate, its level (weak, OK, or what it needs first) and its trend against the sessions before,
 * as the backend works them out (`useErrorProfile`); the thresholds come with the answer. While it loads, blank items hold
 * their place; when it fails, the reason and a retry on one line; before the first counted session, one muted line.
 */
export const ProfileErrorProfile = () => {
  const errorProfile = useErrorProfile();
  const used = errorProfile.data?.sessionsUsed ?? 0;

  const renderBody = () => {
    if (errorProfile.isPending) {
      return (
        <div className={gridClass}>
          {Array.from({ length: BLANK_TYPES }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      );
    }
    if (errorProfile.isError) {
      return (
        <p role="alert" className="text-base text-muted-foreground">
          <span className="text-destructive">Error profile could not load.</span> {getApiErrorMessage(errorProfile.error, 'Please try again.')} ·{' '}
          <button type="button" onClick={() => void errorProfile.refetch()} className={linkClass}>
            Try again
          </button>
        </p>
      );
    }
    if (errorProfile.data.sessionsUsed === 0) {
      return <p className="text-base text-muted-foreground">No counted sessions yet: your error profile starts with your first one.</p>;
    }
    return (
      <ul className={gridClass}>
        {errorProfile.data.types.map((item) => (
          <ErrorTypeItem key={item.type} item={item} profile={errorProfile.data} />
        ))}
      </ul>
    );
  };

  return (
    <section aria-label="Error profile" aria-busy={errorProfile.isPending}>
      {/* PANEL Error profile */}
      <Panel
        title="Error profile"
        titleTip={
          errorProfile.data &&
          `Your last ${errorProfile.data.window} counted sessions: a type is weak from ${errorProfile.data.weakRate}% wrong, and its trend compares them with the ${errorProfile.data.window} sessions before.`
        }
        bare
        titleClassName={sectionTitleClass}
        className="space-y-4"
        actions={used > 0 && <p className="text-base text-muted-foreground">Last {used} counted {used === 1 ? 'session' : 'sessions'}</p>}
      >
        {renderBody()}
      </Panel>
    </section>
  );
};
