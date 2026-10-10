import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const loginSchema = registerSchema;

export const otpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(6),
  newPassword: z.string().min(6)
});

export const googleLoginSchema = z.object({
  credential: z.string().min(1)
});
