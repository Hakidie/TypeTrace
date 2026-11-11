import type { ReactElement } from 'react';
import { CircleCheck, Lock, Minus, TrendingDown, TrendingUp, TriangleAlert, type LucideIcon } from 'lucide-react';
import { ERROR_CHANCE_WORDS } from '@/modules/daily-tasks/daily-tasks.config';
import { errorLabels } from '@/modules/typing/typing.config';
import { LabeledTag } from '@/shared/components/labeled-tag';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { SessionErrorType } from '@/shared/lib/typing-language';
import { cn } from '@/shared/lib/utils';
import type { ErrorProfile, ErrorTrend, ErrorTypeProfile } from '../types/profile.types';

// The focus ring of the hints reached with the keyboard, as on the tags.
const hintFocusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** The words and the icon of each trend: the error rate going down is the learner getting better. */
const TREND_INFO: Record<Exclude<ErrorTrend, 'insufficient_data'>, { label: string; icon: LucideIcon; className: string }> = {
  improved: { label: 'Improving', icon: TrendingDown, className: 'text-primary' },
  worse: { label: 'Getting worse', icon: TrendingUp, className: 'text-destructive' },
  unchanged: { label: 'Steady', icon: Minus, className: 'text-muted-foreground' },
};

/**
 * The words that give a chance of an error type (`tagWord`, `tagEnglishWord`): "words with đ", or `null` where every word
 * does. In English (SCRUM-219) every word can get a letter too many, and every word with letters one wrong, left out or
 * in the wrong case; a swap needs two different letters side by side, a punctuation error a mark in the word.
 */
const CHANCE_WORDS: Record<SessionErrorType, string | null> = {
  ...ERROR_CHANCE_WORDS,
  LETTER_WRONG: null,
  LETTER_MISSING: null,
  LETTER_EXTRA: null,
  LETTERS_SWAPPED: 'words of two letters or more',
  CASE_WRONG: null,
  PUNCTUATION_WRONG: 'words with punctuation',
};

/** The words that give a chance of an error type: "words with đ", or "words" where every word does. */
const chanceWords = (type: SessionErrorType) => CHANCE_WORDS[type] ?? 'words';

/** "12 more words with đ", "1 more word": what a type still needs for a level. */
const missingWords = (type: SessionErrorType, missing: number) =>
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

interface ErrorTypeCardProps extends ItemProps {
  /** Makes the whole card a button (Weak spots, SCRUM-74): a click practices this error type. */
  onSelect?: () => void;
  /** The learner's plan cannot practice it: a lock by the rate, and the click opens the plan. */
  locked?: boolean;
}

/**
 * One error type of the error profile (SCRUM-27): its name and error rate (a dash before it has a level), a bar of the rate
 * that runs to twice the weak line, so the line (the mark) is in its middle, then the level and the trend. The bar and the
 * line under it are pushed to the bottom of the card, so the bars of a row line up when a long name takes two lines. It is
 * an item of a list: the Profile's error profile, and the cards of the Weak spots tab, where `onSelect` makes it a button
 * (one laid over the card, under its hints, so the tooltips still open).
 */
export const ErrorTypeCard = ({ item, profile, onSelect, locked = false }: ErrorTypeCardProps) => {
  const hasLevel = item.level !== 'insufficient_data';
  const filled = hasLevel ? Math.min(item.rate / (profile.weakRate * 2), 1) * 100 : 0;

  return (
    <li className={cn('relative -mr-3 -ml-4 flex flex-col gap-3 py-3 pr-3 pl-4 transition-colors hover:bg-primary/15', onSelect && 'cursor-pointer')}>
      {onSelect && (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Practice ${errorLabels[item.type]}${locked ? ' (Premium)' : ''}`}
          className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}
      <div className={cn('flex items-baseline justify-between gap-3', onSelect && 'pointer-events-none relative')}>
        <p className="min-w-0 text-xl font-extrabold text-primary/80">{errorLabels[item.type]}</p>
        <p className={cn('inline-flex shrink-0 items-center gap-2 text-xl font-extrabold tabular-nums', hasLevel ? 'text-primary' : 'text-muted-foreground')}>
          {locked && <Lock className="size-4 text-muted-foreground" aria-hidden />}
          {hasLevel ? `${item.rate}%` : '—'}
        </p>
      </div>
      <div className={cn('mt-auto space-y-3', onSelect && 'pointer-events-none relative')}>
        <div className="relative h-2 bg-muted" aria-hidden>
          <div className={cn('h-full', item.level === 'weak' ? 'bg-primary' : 'bg-primary/40')} style={{ width: `${filled}%` }} />
          <div className="absolute -inset-y-1 left-1/2 w-0.5 bg-foreground/40" />
        </div>
        <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-base">
          <span className="pointer-events-auto">
            <LevelMark item={item} profile={profile} />
          </span>
          <span className="pointer-events-auto">
            <TrendMark item={item} profile={profile} />
          </span>
        </div>
      </div>
    </li>
  );
};
