import type { TutorialState } from '@/modules/tutorial/types/tutorial.types';
import type { AvatarLook } from '@/modules/avatar/types/avatar.types';
import type { AppFont } from '@/shared/lib/app-font';
import type { TypingLanguage } from '@/shared/lib/typing-language';

export interface AuthPayload {
  email: string;
  password: string;
}

export type UserRole = 'user' | 'admin';

export interface CurrentUser {
  _id: string;
  email: string;
  isEmailVerified: boolean;
  role: UserRole;
  loginOtpEnabled: boolean;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  /** What the account shows: its uploaded picture or its pixel avatar (the picture is kept while the pixel avatar is shown). Missing on old data: the picture. */
  avatarSource?: 'picture' | 'pixel';
  phone?: string;
  /** The pixel avatar the user wears (missing on old data: `DEFAULT_AVATAR`). */
  avatar?: AvatarLook;
  /** Earned in rated duels; only the user sees their own. */
  coins?: number;
  /** Bought or won avatar items, as `slot:item`. */
  ownedItems?: string[];
  /** Whether the learner is on Premium (US11.1) and until when (an ISO date), sent by `GET /api/auth/me`. */
  premium?: { active: boolean; until: string | null };
  /**
   * Only what the frontend reads: the IANA time zone the learner's days are counted in (`Asia/Ho_Chi_Minh` until the browser
   * sends its own), the language they type in Practice (SCRUM-219; missing on old data: Vietnamese, `useTypingLanguage`), the passage
   * font size in rem and the interface font (SCRUM-158; missing on old data: the defaults, `useSettings`).
   */
  settings?: { timezone?: string; typingLanguage?: TypingLanguage; typingFontSizeRem?: number; fontFamily?: AppFont };
  /** Ping's tutorial (`modules/tutorial`): missing on accounts from before it, which are never shown one. */
  tutorial?: TutorialState;
  createdAt: string;
  updatedAt: string;
}

export interface MessageResponse {
  message: string;
}

/** `/auth/login` answers with a token, or asks for the emailed OTP when the user enabled it. */
export type LoginResponse =
  | { token: string }
  | { message: string; requiresOtp: true; email: string };
