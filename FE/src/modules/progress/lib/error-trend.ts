// The error rate chart (SCRUM-30, US4.2): one line per error type of a language; the numbers come from `GET /api/profile/error-trend`.
import { errorTypesOf, type SessionErrorType, type TypingLanguage } from '@/shared/lib/typing-language';
import type { ChartRange } from '@/modules/profile/types/profile.types';
import type { ErrorTrendPoint } from '../types/progress.types';

/** The error types of a language, in the order of its set: five Vietnamese ones, six English ones (SCRUM-219). */
export const errorTrendTypes = (language: TypingLanguage): SessionErrorType[] => errorTypesOf(language);

/**
 * How each line is drawn. Colors are theme tokens only, so the lines are told apart by token and by dash: the main red, solid or
 * dashed, the text color, solid or dashed, and the muted text color.
 */
export const ERROR_TREND_STYLES: Record<SessionErrorType, { color: string; dash?: string }> = {
  BASE_LETTER: { color: 'var(--primary)' },
  D_MISSING: { color: 'var(--primary)', dash: '6 4' },
  MARK_WRONG: { color: 'var(--foreground)' },
  TONE_WRONG: { color: 'var(--foreground)', dash: '6 4' },
  HOI_NGA_CONFUSION: { color: 'var(--muted-foreground)' },
  LETTER_WRONG: { color: 'var(--primary)' },
  LETTER_MISSING: { color: 'var(--primary)', dash: '6 4' },
  LETTER_EXTRA: { color: 'var(--foreground)' },
  LETTERS_SWAPPED: { color: 'var(--foreground)', dash: '6 4' },
  CASE_WRONG: { color: 'var(--muted-foreground)' },
  PUNCTUATION_WRONG: { color: 'var(--muted-foreground)', dash: '6 4' },
};

/**
 * The columns the chart draws: a week shows all its days, a year or a month starts at the first period with a rate (the periods
 * before the learner's first session have none), as the WPM chart does. All of them while there is no rate at all.
 */
export const shownTrendPoints = (range: ChartRange, points: ErrorTrendPoint[]) => {
  if (range === 'week') return points;
  const first = points.findIndex((point) => Object.values(point.rates).some((rate) => rate != null));
  return first === -1 ? points : points.slice(first);
};

/** True when no period has a rate: nothing to draw yet. */
export const hasNoTrend = (points: ErrorTrendPoint[]) => points.every((point) => Object.values(point.rates).every((rate) => rate == null));
