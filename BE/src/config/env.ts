import dotenv from 'dotenv';
import { z } from 'zod';

// Tests get their variables from vitest.config.mts only, so a developer's own
// BE/.env (real SMTP, OpenAI key, ...) never changes how the tests behave.
if (process.env.NODE_ENV !== 'test') dotenv.config({ quiet: true });

const PLACEHOLDER_JWT_SECRET = 'change_this_secret';

const optionalString = z.string().trim().optional().transform((value) => value || undefined);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5003),
    MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    JWT_EXPIRES_IN: z.string().default('1d'),
    CLIENT_URL: z.string().default('http://localhost:5173'),
    // Number of reverse proxies in front of the app (Render, Railway, Nginx: usually 1).
    // Needed so rate limits see the real client IP instead of the proxy's.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z.string().optional().transform((value) => value === 'true'),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    EMAIL_FROM: z.string().default('no-reply@example.com'),
    OTP_EXPIRES_MINUTES: z.coerce.number().positive().default(10),
    RESET_TOKEN_EXPIRES_MINUTES: z.coerce.number().positive().default(15),
    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
    // Key: https://platform.openai.com/api-keys
    OPENAI_API_KEY: optionalString,
    // Optional. OAuth client ID for "Login with Google" (https://console.cloud.google.com/apis/credentials).
    GOOGLE_CLIENT_ID: optionalString,
    OPENAI_MODEL: z.string().trim().min(1).default('gpt-4.1-mini')
  })
  .superRefine((value, ctx) => {
    const weakSecret = value.JWT_SECRET === PLACEHOLDER_JWT_SECRET || value.JWT_SECRET.length < 32;
    if (value.NODE_ENV === 'production' && weakSecret) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'must be at least 32 characters and not the example value in production'
      });
    }
  });

export type RawEnv = Record<string, string | undefined>;

/** Parses raw variables into the typed config. Throws a readable error listing every bad variable. */
export const parseEnv = (raw: RawEnv) => {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}`);
  }

  const v = result.data;
  return {
    nodeEnv: v.NODE_ENV,
    port: v.PORT,
    mongoUri: v.MONGO_URI,
    jwtSecret: v.JWT_SECRET,
    jwtExpiresIn: v.JWT_EXPIRES_IN,
    clientUrl: v.CLIENT_URL,
    trustProxy: v.TRUST_PROXY,
    smtpHost: v.SMTP_HOST,
    smtpPort: v.SMTP_PORT,
    smtpSecure: v.SMTP_SECURE,
    smtpUser: v.SMTP_USER,
    smtpPass: v.SMTP_PASS,
    emailFrom: v.EMAIL_FROM,
    otpExpiresMinutes: v.OTP_EXPIRES_MINUTES,
    resetTokenExpiresMinutes: v.RESET_TOKEN_EXPIRES_MINUTES,
    cloudinaryCloudName: v.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: v.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: v.CLOUDINARY_API_SECRET,
    openaiApiKey: v.OPENAI_API_KEY,
    googleClientId: v.GOOGLE_CLIENT_ID,
    openaiModel: v.OPENAI_MODEL
  };
};

export const env = parseEnv(process.env as RawEnv);
