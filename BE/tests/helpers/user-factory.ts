import { UserModel, UserRole, UserStatus } from '../../src/models/user.model';
import { hashPassword } from '../../src/utils/hash';
import { signToken } from '../../src/utils/jwt';

export const DEFAULT_PASSWORD = 'Passw0rd!';

interface UserOverrides {
  email?: string;
  password?: string;
  isEmailVerified?: boolean;
  displayName?: string;
  avatarUrl?: string;
  role?: UserRole;
  status?: UserStatus;
  loginOtpEnabled?: boolean;
}

/** Creates a persisted user; verified by default so login tests can proceed. */
export const createUser = async (overrides: UserOverrides = {}) => {
  const email = overrides.email ?? 'user@example.com';
  return UserModel.create({
    email,
    password: await hashPassword(overrides.password ?? DEFAULT_PASSWORD),
    isEmailVerified: overrides.isEmailVerified ?? true,
    displayName: overrides.displayName,
    avatarUrl: overrides.avatarUrl,
    role: overrides.role,
    status: overrides.status,
    loginOtpEnabled: overrides.loginOtpEnabled
  });
};

/** Bearer header for a persisted user, mirroring a completed login. */
export const bearerFor = (user: { _id: unknown; email: string }) =>
  `Bearer ${signToken({ sub: String(user._id), email: user.email })}`;

/** Reads OTP / reset token straight from the database (never exposed by the API). */
export const readSecrets = async (email: string) => {
  const user = await UserModel.findOne({ email });
  return {
    otpCode: user?.otpCode,
    otpExpiresAt: user?.otpExpiresAt,
    resetToken: user?.resetToken,
    resetTokenExpiresAt: user?.resetTokenExpiresAt
  };
};
