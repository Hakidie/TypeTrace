import type { CurrentUser, UserRole } from '@/modules/auth/types/auth.types';

export interface AdminStats {
  users: number;
  admins: number;
  verified: number;
  newUsersThisWeek: number;
  notes: number;
}

export interface UserTypingStats {
  /** Average words per minute. */
  wpm: number;
  /** 0 to 100. */
  accuracy: number;
}

export interface UserLoginDay {
  /** `YYYY-MM-DD`. */
  date: string;
  sessions: number;
}

/** A user of the admin list with the typing activity the backend adds. */
export interface AdminUser extends CurrentUser {
  /** Absent until the user completed a typing session. */
  stats?: UserTypingStats;
  logins?: UserLoginDay[];
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
