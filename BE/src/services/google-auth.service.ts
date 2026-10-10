import crypto from 'crypto';
import { env } from '../config/env';
import { UserModel } from '../models/user.model';
import { AppError, unauthorized } from '../utils/app-error';
import { hashPassword } from '../utils/hash';

interface GoogleTokenInfo {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
}

/** Asks Google to check an ID token ("credential") and returns the verified email. */
const verifyGoogleCredential = async (credential: string) => {
  if (!env.googleClientId) throw new AppError(503, 'Google login is not configured');

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) throw unauthorized('Invalid Google credential');

  const info = (await response.json()) as GoogleTokenInfo;
  const emailVerified = info.email_verified === true || info.email_verified === 'true';
  if (info.aud !== env.googleClientId || !info.email || !emailVerified) {
    throw unauthorized('Invalid Google credential');
  }
  return info.email.toLowerCase();
};

/**
 * Finds the user with the Google email or creates one (already verified, random password
 * so the account can only be entered through Google or the "forgot password" flow).
 */
export const findOrCreateGoogleUser = async (credential: string) => {
  const email = await verifyGoogleCredential(credential);

  const existing = await UserModel.findOne({ email });
  if (existing) {
    if (!existing.isEmailVerified) {
      existing.isEmailVerified = true;
      await existing.save();
    }
    return existing;
  }

  return UserModel.create({
    email,
    password: await hashPassword(crypto.randomBytes(32).toString('hex')),
    isEmailVerified: true
  });
};
