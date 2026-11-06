// A learner's error profile (SCRUM-27): for each Vietnamese error type, the error rate of their last counted sessions, a
// level (weak or ok, once there is enough data) and a trend against the sessions before them. It is worked out from the
// sessions each time it is read and never stored: it is up to date right after a session, needs no rebuild when a rule
// changes, and leaves nothing to delete with the user. Only models are imported, so no service cycle can start here.
import type { Types } from 'mongoose';
import { ErrorCounts, TypingSessionModel } from '../models/typing-session.model';
import { UserModel } from '../models/user.model';
import { notFound } from '../utils/app-error';
import { WordError, WordErrorType } from '../utils/vietnamese-errors';

/** The current window is the learner's last `PROFILE_WINDOW` counted sessions, the previous one the `PROFILE_WINDOW` before them. */
export const PROFILE_WINDOW = 10;
/** Fewer chances of an error type than this in a window say too little: no level and no trend for that type. */
export const MIN_PROFILE_OPPORTUNITIES = 20;
/** An error type is weak from this error rate on, in %. */
export const WEAK_RATE = 15;
/** How many standard errors apart the rates of the two windows must be to call it a change (two-proportion z-test; 1.96 = 95 %). */
export const TREND_Z = 1.96;

export type ErrorLevel = 'insufficient_data' | 'weak' | 'ok';
export type ErrorTrend = 'insufficient_data' | 'improved' | 'worse' | 'unchanged';

/** What the profile reads of a session: its errors and chances of each type (a missing count is 0). */
export interface ProfileSession {
  errorCounts?: Partial<ErrorCounts>;
  opportunityCounts?: Partial<ErrorCounts>;
}

/** Errors and chances of one error type in some sessions. */
export interface ErrorTotals {
  errors: number;
  opportunities: number;
}

export interface ErrorTypeProfile extends ErrorTotals {
  type: WordErrorType;
  /** Errors / chances of the current window in %, one decimal (as the session stats); 0 without a chance, at most 100. */
  rate: number;
  level: ErrorLevel;
  /** The same rate in the previous window. */
  previousRate: number;
  trend: ErrorTrend;
}

/** `GET /api/profile/error-profile`. The thresholds come along so the frontend never writes them. */
export interface ErrorProfile {
  window: number;
  minOpportunities: number;
  weakRate: number;
  /** Sessions in the current window: 0 to `PROFILE_WINDOW`. */
  sessionsUsed: number;
  /** One per error type, in the order of `WordError`. */
  types: ErrorTypeProfile[];
  /** The weak types, highest error rate first (a tie goes to more errors, then to the order of `WordError`). */
  weakTypes: WordErrorType[];
}

type OwnerId = string | Types.ObjectId;

const round1 = (value: number) => Math.round(value * 10) / 10;

const totalsOf = (sessions: readonly ProfileSession[], type: WordErrorType): ErrorTotals => ({
  errors: sessions.reduce((sum, session) => sum + (session.errorCounts?.[type] ?? 0), 0),
  opportunities: sessions.reduce((sum, session) => sum + (session.opportunityCounts?.[type] ?? 0), 0)
});

/**
 * At most 100: a vowel mark typed on a word without one is a MARK_WRONG error on a word that gave no chance of it, so a
 * type can have more errors than chances.
 */
const rateOf = ({ errors, opportunities }: ErrorTotals) =>
  opportunities === 0 ? 0 : Math.min(100, round1((errors / opportunities) * 100));

/**
 * `weak` from `WEAK_RATE` %, compared in whole numbers (errors × 100 ≥ WEAK_RATE × chances): a sum of decimals can miss the
 * edge (in JavaScript `0.15 >= 0.05 + 0.1` is false).
 */
export const levelOf = ({ errors, opportunities }: ErrorTotals): ErrorLevel => {
  if (opportunities < MIN_PROFILE_OPPORTUNITIES) return 'insufficient_data';
  return errors * 100 >= WEAK_RATE * opportunities ? 'weak' : 'ok';
};

/**
 * The trend of an error type from the previous window to the current one: a two-proportion z-test, so a change counts
 * only when it is bigger than what chance alone moves the rate with the chances there are (30 chances of đ swing much
 * more than 400 letters). `insufficient_data` while either window has fewer than `MIN_PROFILE_OPPORTUNITIES` chances.
 */
export const trendOf = (current: ErrorTotals, previous: ErrorTotals): ErrorTrend => {
  if (current.opportunities < MIN_PROFILE_OPPORTUNITIES || previous.opportunities < MIN_PROFILE_OPPORTUNITIES) {
    return 'insufficient_data';
  }
  const pooled = (current.errors + previous.errors) / (current.opportunities + previous.opportunities);
  const standardError = Math.sqrt(pooled * (1 - pooled) * (1 / current.opportunities + 1 / previous.opportunities));
  // 0 when neither window has an error (or every chance was one), NaN with more errors than chances: nothing to compare.
  if (!(standardError > 0)) return 'unchanged';
  const z = (current.errors / current.opportunities - previous.errors / previous.opportunities) / standardError;
  if (z <= -TREND_Z) return 'improved';
  if (z >= TREND_Z) return 'worse';
  return 'unchanged';
};

/**
 * The profile of up to `2 × PROFILE_WINDOW` counted sessions given newest first (pure, for the tests): the first
 * `PROFILE_WINDOW` are the current window, the next ones the previous window.
 */
export const computeErrorProfile = (sessions: readonly ProfileSession[]): ErrorProfile => {
  const current = sessions.slice(0, PROFILE_WINDOW);
  const previous = sessions.slice(PROFILE_WINDOW, PROFILE_WINDOW * 2);
  const types = Object.values(WordError).map((type): ErrorTypeProfile => {
    const now = totalsOf(current, type);
    const before = totalsOf(previous, type);
    return { type, ...now, rate: rateOf(now), level: levelOf(now), previousRate: rateOf(before), trend: trendOf(now, before) };
  });
  // A weak type has at least MIN_PROFILE_OPPORTUNITIES chances, so no division by 0; the sort is stable, so the order of
  // WordError settles what is left of a tie.
  const weakTypes = types
    .filter((profile) => profile.level === 'weak')
    .sort((a, b) => b.errors / b.opportunities - a.errors / a.opportunities || b.errors - a.errors)
    .map((profile) => profile.type);
  return {
    window: PROFILE_WINDOW,
    minOpportunities: MIN_PROFILE_OPPORTUNITIES,
    weakRate: WEAK_RATE,
    sessionsUsed: current.length,
    types,
    weakTypes
  };
};

/**
 * The learner's last counted sessions that have chances (sessions saved before the chances were counted have none), newest
 * first, two windows of them, through the index `{ owner: 1, completedAt: -1 }` of TypingSession.
 */
const profileSessionsOf = (owner: OwnerId): Promise<ProfileSession[]> =>
  TypingSessionModel.find({ owner, status: 'completed', isCounted: true, opportunityCounts: { $exists: true } })
    .sort({ completedAt: -1 })
    .limit(PROFILE_WINDOW * 2)
    .select('errorCounts opportunityCounts')
    .lean();

/** The signed-in learner's error profile; the token of a deleted account answers 404, like the other profile endpoints. */
export const getErrorProfile = async (userId: string) => {
  if (!(await UserModel.exists({ _id: userId }))) throw notFound('User not found');
  return computeErrorProfile(await profileSessionsOf(userId));
};

/** The learner's weak error types, highest error rate first, at most `limit`: what a practice aimed at their errors trains (US3.2). */
export const getWeakErrorTypes = async (userId: OwnerId, limit = 2) =>
  computeErrorProfile(await profileSessionsOf(userId)).weakTypes.slice(0, limit);
