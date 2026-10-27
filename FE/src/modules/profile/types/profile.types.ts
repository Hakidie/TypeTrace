import type { ActivityDay } from '@/shared/components/activity-heatmap';
import type { SessionMode, SessionStatus, SessionTimeline } from '@/modules/typing/types/typing.types';

/** Average speed and accuracy of the learner's completed sessions. */
export interface TypingStats {
  wpm: number;
  accuracy: number;
}

/** `GET /api/sessions/activity`: the learner's own typing activity, shown on the profile page (SCRUM-157). */
export interface TypingActivity {
  /** Absent until a session is completed. */
  stats?: TypingStats;
  /** Completed sessions per UTC day of the last `HEATMAP_DAYS` days. */
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
