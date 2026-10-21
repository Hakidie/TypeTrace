import mongoose, { Schema, Types } from 'mongoose';

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'locked'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

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
  phone?: string;
  /** The mode in use and the theme chosen for each mode (`null` = the built-in fallback of that mode). */
  settings: {
    mode: 'dark' | 'light';
    darkTheme: Types.ObjectId | null;
    lightTheme: Types.ObjectId | null;
  };
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
    phone: { type: String, trim: true },
    settings: {
      type: new Schema(
        {
          mode: { type: String, enum: ['dark', 'light'], default: 'dark' },
          darkTheme: { type: Schema.Types.ObjectId, ref: 'Theme', default: null },
          lightTheme: { type: Schema.Types.ObjectId, ref: 'Theme', default: null }
        },
        { _id: false }
      ),
      default: () => ({})
    }
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
