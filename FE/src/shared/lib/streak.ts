import { HEATMAP_DAYS, type ActivityDay } from '@/shared/components/activity-heatmap';

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/** Days in a row with a session, counted back from today. A day without one today does not break it yet: it counts from yesterday. */
export const currentStreak = (days: ActivityDay[] = []) => {
  const active = new Set(days.filter((day) => day.sessions > 0).map((day) => day.date));
  const cursor = new Date();
  if (!active.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (streak < HEATMAP_DAYS && active.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};
