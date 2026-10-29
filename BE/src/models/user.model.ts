import mongoose, { Schema, Types } from 'mongoose';
import { AvatarLook, DEFAULT_AVATAR } from '../data/avatar-catalog';

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'locked'] as const;
/** What other players see of an account without a display name (never its email). */
export const ANONYMOUS_PLAYER_NAME = 'Anonymous player';
export type UserStatus = (typeof USER_STATUSES)[number];

/** The zone of the days of a learner who never sent their own (SCRUM-31). Readers fall back to it: old users have none stored. */
export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface UserDocument extends mongoose.Document {
  email: string;
  password: string;
  isEmailVerified: boolean;
  role: UserRole;
  /** A locked account cannot log in and its tokens are rejected. */
  status: UserStatus;
  /** When the account was locked; cleared on unlock. */
  lockedAt?: Date;
  /** When true, login sends an email OTP before issuing a token. */
  loginOtpEnabled: boolean;
  otpCode?: string;
  otpExpiresAt?: Date;
  resetToken?: string;
  resetTokenExpiresAt?: Date;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  /** Which one the account shows: its uploaded picture (`avatarUrl`) or its pixel avatar (`avatar`). The picture is kept while the pixel avatar is shown. */
  avatarSource: 'picture' | 'pixel';
  phone?: string;
  /** The mode in use and the theme chosen for each mode (`null` = the built-in fallback of that mode). */
  settings: {
    mode: 'dark' | 'light';
    darkTheme: Types.ObjectId | null;
    lightTheme: Types.ObjectId | null;
    /** IANA time zone of the learner's days: streak, daily mission and profile heatmap (SCRUM-31). Sent by the browser. */
    timezone: string;
  };
  /** The pixel avatar the user wears (ranked duel design, section 7). Missing on accounts saved before: `DEFAULT_AVATAR`. */
  avatar: AvatarLook;
  /** The avatar items bought or won, as `slot:item` (`itemKey`); the free items are never listed. */
  ownedItems: string[];
  /** Earned in rated duels (phase 6). Only the account itself sees it (`/me`, the avatar catalog). */
  coins: number;
}

/** Fields that must never leave the server. Stripped from every JSON response. */
export const PRIVATE_USER_FIELDS = [
  'password',
  'otpCode',
  'otpExpiresAt',
  'resetToken',
  'resetTokenExpiresAt',
  '__v'
] as const;

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    role: { type: String, enum: USER_ROLES, default: 'user' },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    lockedAt: { type: Date },
    loginOtpEnabled: { type: Boolean, default: false },
    otpCode: { type: String },
    otpExpiresAt: { type: Date },
    resetToken: { type: String },
    resetTokenExpiresAt: { type: Date },
    displayName: { type: String, trim: true },
    bio: { type: String, maxlength: 200 },
    avatarUrl: { type: String },
    avatarPublicId: { type: String },
    avatarSource: { type: String, enum: ['picture', 'pixel'], default: 'picture' },
    phone: { type: String, trim: true },
    settings: {
      type: new Schema(
        {
          mode: { type: String, enum: ['dark', 'light'], default: 'dark' },
          darkTheme: { type: Schema.Types.ObjectId, ref: 'Theme', default: null },
          lightTheme: { type: Schema.Types.ObjectId, ref: 'Theme', default: null },
          // Checked by `PATCH /api/profile/settings`, not here: a zone unknown to a later server must not block a save.
          timezone: { type: String, default: DEFAULT_TIMEZONE }
        },
        { _id: false }
      ),
      default: () => ({})
    },
    avatar: {
      type: new Schema(
        {
          skin: { type: String, default: DEFAULT_AVATAR.skin },
          face: { type: String, default: DEFAULT_AVATAR.face },
          hair: { type: String, default: DEFAULT_AVATAR.hair },
          top: { type: String, default: DEFAULT_AVATAR.top },
          bottom: { type: String, default: DEFAULT_AVATAR.bottom },
          shoes: { type: String, default: DEFAULT_AVATAR.shoes },
          headwear: { type: String, default: null },
          accessory: { type: String, default: null },
          back: { type: String, default: null },
          effect: { type: String, default: null }
        },
        { _id: false }
      ),
      default: () => ({})
    },
    ownedItems: { type: [String], default: [] },
    coins: { type: Number, default: 0, min: 0 }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        for (const field of PRIVATE_USER_FIELDS) delete ret[field];
        return ret;
      }
    }
  }
);

export const UserModel = mongoose.model<UserDocument>('User', userSchema);
