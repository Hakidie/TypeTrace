import type { ActivityDay } from '@/shared/components/activity-heatmap';

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
