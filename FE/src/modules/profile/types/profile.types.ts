import type { ActivityDay } from '@/shared/components/activity-heatmap';
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
  /** Absent until a session is completed. Every completed session counts here, counted or not. */
  stats?: TypingStats;
  /** The learner's time zone (`settings.timezone`): the dates of `sessions` are days in it. */
  timezone: string;
  /** Counted sessions per day of the last `HEATMAP_DAYS` days, oldest first, with the days the daily mission was done. */
  sessions: ActivityDay[];
}

/** One item of `GET /api/sessions`: a session without its words (the result page loads those). */
export interface SessionSummary {
  _id: string;
  mode: SessionMode;
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
  };
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
