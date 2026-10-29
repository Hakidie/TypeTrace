import { http } from '@/shared/api/http';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import type { Paginated } from '@/shared/api/types';
import type { DailyTasks, SessionListParams, SessionSummary, Streak, TypingActivity } from '../types/profile.types';

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  phone?: string;
}

export interface UpdateSecurityInput {
  loginOtpEnabled: boolean;
}

export interface UpdateSettingsInput {
  /** An IANA time zone, e.g. `Europe/Paris`: the learner's days (streak, mission, heatmap) are counted in it. */
  timezone: string;
}

/** Every function resolves with the response body (not the Axios response). */
export const profileApi = {
  // The signed-in learner's own typing activity (the typing sessions API, SCRUM-157).
  getActivity: () => http.get<TypingActivity>('/sessions/activity').then((r) => r.data),
  // The learner's own typing sessions, one page of summaries (the typing sessions API).
  getSessions: (params: SessionListParams) =>
    http.get<Paginated<SessionSummary>>('/sessions', { params }).then((r) => r.data),
  // The learner's streak and today's daily mission (SCRUM-31).
  getStreak: () => http.get<Streak>('/profile/streak').then((r) => r.data),
  // The learner's tasks of today, with how far they are (SCRUM-112).
  getDailyTasks: () => http.get<DailyTasks>('/profile/daily-tasks').then((r) => r.data),
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
