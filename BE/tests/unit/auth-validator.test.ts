import { PASSWORD_MIN_LENGTH } from '@typetrace/shared';
import { describe, expect, it } from 'vitest';
import {
  forgotPasswordSchema,
  loginSchema,
  otpSchema,
  registerSchema,
  resetPasswordSchema
} from '../../src/validators/auth.validator';

describe('registerSchema', () => {
  it('accepts a valid payload', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: 'secret1' }).success).toBe(true);
  });

  it.each(['not-an-email', 'a@', '@b.com', '', 'a b@c.com'])('rejects email %j', (email) => {
    expect(registerSchema.safeParse({ email, password: 'secret1' }).success).toBe(false);
  });

  it('rejects a password shorter than PASSWORD_MIN_LENGTH (shared with the frontend forms)', () => {
    const password = 'x'.repeat(PASSWORD_MIN_LENGTH);
    expect(registerSchema.safeParse({ email: 'a@b.com', password }).success).toBe(true);
    expect(registerSchema.safeParse({ email: 'a@b.com', password: password.slice(1) }).success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(registerSchema.safeParse({}).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('shares the register rules', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '123456' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '123' }).success).toBe(false);
  });
});

describe('otpSchema', () => {
  it('accepts a 6-character OTP', () => {
    expect(otpSchema.safeParse({ email: 'a@b.com', otp: '123456' }).success).toBe(true);
  });

  it.each(['12345', '1234567', ''])('rejects OTP %j by length', (otp) => {
    expect(otpSchema.safeParse({ email: 'a@b.com', otp }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('requires a valid email only', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts a valid payload', () => {
    const result = resetPasswordSchema.safeParse({
      email: 'a@b.com',
      token: '123456',
      newPassword: 'brand-new'
    });
    expect(result.success).toBe(true);
  });

  it('rejects a short token or short password', () => {
    const base = { email: 'a@b.com', token: '123456', newPassword: 'brand-new' };
    expect(resetPasswordSchema.safeParse({ ...base, token: '12345' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ ...base, newPassword: '12345' }).success).toBe(false);
  });
});
