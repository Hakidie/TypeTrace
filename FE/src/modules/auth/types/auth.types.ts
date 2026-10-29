import type { AvatarLook } from '@/modules/avatar/types/avatar.types';

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
  phone?: string;
  /** The pixel avatar the user wears (missing on old data: `DEFAULT_AVATAR`). */
  avatar?: AvatarLook;
  /** Earned in rated duels; only the user sees their own. */
  coins?: number;
  /** Bought or won avatar items, as `slot:item`. */
  ownedItems?: string[];
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
