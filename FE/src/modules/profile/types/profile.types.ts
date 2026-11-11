import type { ActivityDay } from '@/shared/components/activity-heatmap';
import type { SessionErrorType, TypingLanguage } from '@/shared/lib/typing-language';
import type { WordErrorType } from '@/shared/lib/vietnamese-errors';
import type { DailyTaskType } from '@/modules/daily-tasks/types/daily-task.types';
import type { SessionMode, SessionStatus, SessionTimeline } from '@/modules/typing/types/typing.types';

/** Average speed and accuracy of the learner's completed sessions. */
export interface TypingStats {
  wpm: number;
  accuracy: number;
}

/** `GET /api/sessions/activity`: the learner's own typing activity, shown on the profile page (SCRUM-157, SCRUM-31). */
export interface TypingActivity {
  /** Absent until a session is completed in `language`. Every completed session of that language counts here, counted or not. */
  stats?: TypingStats;
  /** The language of `stats` (SCRUM-219): the one asked for, the learner's Practice language. The days count both. */
  language: TypingLanguage;
  /** The learner's time zone (`settings.timezone`): the dates of `sessions` are days in it. */
  timezone: string;
  /** Counted sessions per day of the last `HEATMAP_DAYS` days, oldest first, with the days the daily mission was done. */
  sessions: ActivityDay[];
}

/** One item of `GET /api/sessions`: a session without its words (the result page loads those). */
export interface SessionSummary {
  _id: string;
  mode: SessionMode;
  /** What it was typed in (SCRUM-219); missing on sessions from before: Vietnamese. */
  language?: TypingLanguage;
  /** Missing on sessions from before the title was stored. */
  passageTitle?: string;
  status: SessionStatus;
  wpm?: number;
  accuracy?: number;
  durationMs?: number;
  /** The time the learner chose, in seconds; missing on sessions from before it was stored. */
  timeLimitSeconds?: number;
  isCounted: boolean;
  /** The points of the speed line (as in the stats of the session), or why there are none. */
  timeline: SessionTimeline;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

export interface SessionListParams {
  page: number;
  limit: number;
  sort: string;
  status?: SessionStatus;
  /** Text searched in the passage name. */
  q?: string;
  mode?: SessionMode;
  /** The time the learner chose, in seconds. */
  timeLimitSeconds?: number;
}

/** `GET /api/profile/streak` (SCRUM-31): days in a row with a counted session, and today's daily mission. */
export interface Streak {
  /** The run that ends today, or yesterday while today has no counted session yet; 0 otherwise. */
  current: number;
  /** The longest run ever (at least `current`). */
  longest: number;
  today: {
    /** Today in the learner's time zone, `YYYY-MM-DD`. */
    date: string;
    /** Counted sessions today. */
    sessions: number;
    /** Counted sessions the daily mission asks for (`DAILY_MISSION_SESSIONS` of the backend). */
    missionGoal: number;
    missionCompleted: boolean;
    /** Today's streak reward: the coins it gives (or gave), claimable once today has a counted session. */
    reward: { coins: number; claimed: boolean };
  };
}

/** `POST /api/profile/streak/reward`: the coins just given, and the learner's coins now. */
export interface StreakRewardClaim {
  coins: number;
  totalCoins: number;
}

/** One of the learner's tasks of today (SCRUM-112): a copy of an admin's daily task template, and how far they are. */
export interface DailyTaskProgress {
  /** The id of the template (`DailyTask` of the daily-tasks module) the task was copied from. */
  id: string;
  title: string;
  /** '' when there is none. */
  description: string;
  type: DailyTaskType;
  target: number;
  /** Only on an accuracy task that focuses on one error type. */
  errorType?: WordErrorType;
  /** The coins completing it pays (SCRUM-301), as the template had them when the day was made; 0 = no reward. */
  coins: number;
  /** Whether those coins were already added to the learner's account. Only the server pays. */
  rewarded: boolean;
  /**
   * In the unit of the target, from today's counted sessions only: sessions, minutes (one decimal, rounded down), the best
   * WPM or the best accuracy (%) of one session; for a focused task, the best accuracy on its error type in a session
   * that gave it at least `MIN_FOCUS_CHANCES` chances (daily-tasks.config.ts; 0 until one did).
   */
  progress: number;
  completed: boolean;
}

/** `GET /api/profile/daily-tasks` (SCRUM-112): the learner's tasks of today, in their time zone. */
export interface DailyTasks {
  /** Today in the learner's time zone, `YYYY-MM-DD`. */
  date: string;
  /** In the order they were given; [] when no task is active. */
  tasks: DailyTaskProgress[];
}

/** How an error type stands in the learner's last counted sessions (SCRUM-27): no level under `minOpportunities` chances. */
export type ErrorLevel = 'insufficient_data' | 'weak' | 'ok';

/** The change from the sessions before (SCRUM-27): no trend while either window has fewer than `minOpportunities` chances. */
export type ErrorTrend = 'insufficient_data' | 'improved' | 'worse' | 'unchanged';

/** One error type of the error profile (SCRUM-27). */
export interface ErrorTypeProfile {
  type: SessionErrorType;
  /** Errors and chances of the type in the current window: the learner's last `window` counted sessions. */
  errors: number;
  opportunities: number;
  /** Errors / chances in %, one decimal; 0 without a chance. */
  rate: number;
  level: ErrorLevel;
  /** The same rate in the `window` sessions before. */
  previousRate: number;
  trend: ErrorTrend;
}

/** `GET /api/profile/error-profile` (SCRUM-27). The thresholds come from the backend: never write them in the frontend. */
export interface ErrorProfile {
  /** The language of the sessions it is worked out from (SCRUM-219): the one asked for, the learner's Practice language. */
  language: TypingLanguage;
  /** How many counted sessions a window has (10). */
  window: number;
  /** Chances of a type a window needs for a level or a trend (20). */
  minOpportunities: number;
  /** A type is weak from this error rate on, in % (15). */
  weakRate: number;
  /** Sessions in the current window: 0 to `window`. */
  sessionsUsed: number;
  /** One per error type of `language`, in the order of its set (`WordError` or `EnglishError`). */
  types: ErrorTypeProfile[];
  /** The weak types, highest error rate first. */
  weakTypes: SessionErrorType[];
}

/** What a point of the profile chart covers: a month (`year`: the last 12 months), a block of 7 days of the current month (`month`: 4-5 points) or a day (`week`: the last 7 days). */
export type ChartRange = 'year' | 'month' | 'week';

/** Which lines of the chart show: both, only the speed (WPM) or only the accuracy. */
export type ChartLines = 'all' | 'wpm' | 'accuracy';

/** A year, month or week put on the chart next to the one it shows: the range, and a day ('YYYY-MM-DD') that holds it. */
export interface ChartCompare {
  range: ChartRange;
  date: string;
}

/** One point of `GET /api/profile/monthly-progress` (SCRUM-240). */
export interface MonthlyProgressPoint {
  /** The period: 'YYYY-MM' (`year`), the first day of the block 'YYYY-MM-DD' (`month`) or the day 'YYYY-MM-DD' (`week`). */
  key: string;
  /** Average WPM of the period; `null` before the learner's first counted placement session (in English: their first counted session). */
  avgWpm: number | null;
  /** Average accuracy (0-100) of the period; `null` where `avgWpm` is. */
  avgAccuracy: number | null;
  /** True when the period had no counted session: the figures are the ones of the period before. */
  carriedOver: boolean;
}

/** `GET /api/profile/monthly-progress?range=`: the points of the range, oldest first, the last one being the current month, block or day. */
export interface MonthlyProgress {
  range: ChartRange;
  /** The language of the sessions averaged (SCRUM-219): the one asked for, the learner's Practice language. */
  language: TypingLanguage;
  points: MonthlyProgressPoint[];
}
