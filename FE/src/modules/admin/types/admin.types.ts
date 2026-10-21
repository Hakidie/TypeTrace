import type { CurrentUser, UserRole } from '@/modules/auth/types/auth.types';
import type { ThemeInput } from '@/modules/settings/types/theme.types';
import type { ThemeMode } from '@/shared/lib/theme';

export interface AdminStats {
  users: number;
  admins: number;
  verified: number;
  newUsersThisWeek: number;
  notes: number;
}

export type UserStatus = 'active' | 'locked';

export interface UserTypingStats {
  /** Average words per minute. */
  wpm: number;
  /** 0 to 100. */
  accuracy: number;
}

export interface UserSessionDay {
  /** `YYYY-MM-DD`. */
  date: string;
  sessions: number;
}

/** A user of the admin list with the typing activity the backend adds. */
export interface AdminUser extends CurrentUser {
  /** A locked account cannot log in. Missing counts as active. */
  status?: UserStatus;
  /** Absent until the user completed a typing session. */
  stats?: UserTypingStats;
  sessions?: UserSessionDay[];
}

export interface AdminUserListParams {
  page?: number;
  limit?: number;
  q?: string;
  role?: UserRole | '';
  /** `'true'` / `'false'`, or `''` for all users. */
  verified?: 'true' | 'false' | '';
  sort?: string;
}

export interface AdminUpdateUserInput {
  displayName?: string;
  role?: UserRole;
  isEmailVerified?: boolean;
  loginOtpEnabled?: boolean;
}

export interface AdminThemeListParams {
  page?: number;
  limit?: number;
  q?: string;
  /** `'true'` = dark themes, `'false'` = light themes, `''` = both. */
  isDark?: 'true' | 'false' | '';
  sort?: string;
}

/** A new TypeTrace theme: the name and colors of any theme, plus the mode it is for. */
export interface AdminThemeInput extends ThemeInput {
  mode: ThemeMode;
}
