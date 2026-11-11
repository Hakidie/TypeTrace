import { http } from '@/shared/api/http';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import type { Paginated } from '@/shared/api/types';
import type { TypingLanguage } from '@/shared/lib/typing-language';
import type {
  ChartRange,
  DailyTasks,
  ErrorProfile,
  MonthlyProgress,
  SessionListParams,
  SessionSummary,
  Streak,
  StreakRewardClaim,
  TypingActivity,
} from '../types/profile.types';

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  phone?: string;
}

export interface UpdateSecurityInput {
  loginOtpEnabled: boolean;
}

/** One setting or both. */
export interface UpdateSettingsInput {
  /** An IANA time zone, e.g. `Europe/Paris`: the learner's days (streak, mission, heatmap) are counted in it. */
  timezone?: string;
  /** The language the learner types in Practice (SCRUM-219). */
  typingLanguage?: TypingLanguage;
}

/** Every function resolves with the response body (not the Axios response). */
export const profileApi = {
  // The signed-in learner's own typing activity (the typing sessions API, SCRUM-157), its averages in their typing language (SCRUM-219).
  getActivity: () => http.get<TypingActivity>('/sessions/activity').then((r) => r.data),
  // The learner's own typing sessions, one page of summaries (the typing sessions API).
  getSessions: (params: SessionListParams) =>
    http.get<Paginated<SessionSummary>>('/sessions', { params }).then((r) => r.data),
  // The learner's streak and today's daily mission (SCRUM-31).
  getStreak: () => http.get<Streak>('/profile/streak').then((r) => r.data),
  // Claims today's streak reward (once a day, after the day's first counted session).
  claimStreakReward: () => http.post<StreakRewardClaim>('/profile/streak/reward').then((r) => r.data),
  // The learner's tasks of today, with how far they are (SCRUM-112).
  getDailyTasks: () => http.get<DailyTasks>('/profile/daily-tasks').then((r) => r.data),
  // The learner's error profile: rate, level and trend of each error type in their last counted sessions (SCRUM-27) of
  // `language`, their typing language when missing (SCRUM-219); Weak spots always asks for the Vietnamese one.
  getErrorProfile: (language?: TypingLanguage) =>
    http.get<ErrorProfile>('/profile/error-profile', { params: language ? { language } : undefined }).then((r) => r.data),
  // The learner's average WPM and errors by month (a year), week of this month (a month) or day (a week) (SCRUM-240), in their typing language.
  getMonthlyProgress: (range: ChartRange, date?: string) =>
    http.get<MonthlyProgress>('/profile/monthly-progress', { params: { range, date } }).then((r) => r.data),
  updateProfile: (data: UpdateProfileInput) =>
    http.patch<CurrentUser>('/profile', data).then((r) => r.data),
  updateSecurity: (data: UpdateSecurityInput) =>
    http.patch<CurrentUser>('/profile/security', data).then((r) => r.data),
  updateSettings: (data: UpdateSettingsInput) =>
    http.patch<CurrentUser>('/profile/settings', data).then((r) => r.data),
  /** Shows the uploaded picture or the pixel avatar; the picture is kept. Answers the user. */
  updateAvatarSource: (avatarSource: 'picture' | 'pixel') =>
    http.patch<CurrentUser>('/profile/avatar-source', { avatarSource }).then((r) => r.data),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return http
      .post<{ avatarUrl: string; user: CurrentUser }>('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};
