import { describe, expect, it } from 'vitest';
import { api } from '../helpers/api';
import { UserModel } from '../../src/models/user.model';
import { verifyToken } from '../../src/utils/jwt';
import { emailOutbox, lastEmailTo } from '../helpers/email-outbox';
import { DEFAULT_PASSWORD, bearerFor, createUser, readSecrets } from '../helpers/user-factory';

const email = 'user@example.com';
const credentials = { email, password: DEFAULT_PASSWORD };

// The login OTP step is opt-in per user; these tests cover the opted-in flow.
const createOtpUser = (overrides: Parameters<typeof createUser>[0] = {}) =>
  createUser({ ...overrides, loginOtpEnabled: true });

describe('POST /api/auth/login (step 1)', () => {
  it('answers 202 with requiresOtp and emails a fresh OTP', async () => {
    await createOtpUser({ email });

    const response = await api().post('/api/auth/login').send(credentials);

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ requiresOtp: true, email });
    const { otpCode } = await readSecrets(email);
    expect(otpCode).toMatch(/^\d{6}$/);
    expect(lastEmailTo(email)?.html).toContain(otpCode as string);
  });

  it('never returns a token at step 1', async () => {
    await createOtpUser({ email });
    const response = await api().post('/api/auth/login').send(credentials);
    expect(response.body).not.toHaveProperty('token');
  });

  it('rejects a wrong password with 401 and sends no email', async () => {
    await createOtpUser({ email });

    const response = await api().post('/api/auth/login').send({ email, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password');
    expect(emailOutbox).toHaveLength(0);
  });

  it('returns the same 401 message for an unknown email (no user enumeration)', async () => {
    const response = await api()
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: DEFAULT_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password');
  });

  it('blocks a user whose email is not verified with 403', async () => {
    await createOtpUser({ email, isEmailVerified: false });

    const response = await api().post('/api/auth/login').send(credentials);

    expect(response.status).toBe(403);
    expect(emailOutbox).toHaveLength(0);
  });

  it('replaces a previously issued OTP when login is retried', async () => {
    await createOtpUser({ email });
    await api().post('/api/auth/login').send(credentials);
    const first = await readSecrets(email);

    await api().post('/api/auth/login').send(credentials);
    const second = await readSecrets(email);

    expect(second.otpExpiresAt!.getTime()).toBeGreaterThanOrEqual(first.otpExpiresAt!.getTime());
    expect(emailOutbox).toHaveLength(2);
  });
});

describe('POST /api/auth/login/verify-otp (step 2)', () => {
  const loginAndReadOtp = async () => {
    await api().post('/api/auth/login').send(credentials);
    const { otpCode } = await readSecrets(email);
    return otpCode as string;
  };

  it('returns a usable JWT and clears the OTP', async () => {
    await createOtpUser({ email });
    const otp = await loginAndReadOtp();

    const response = await api().post('/api/auth/login/verify-otp').send({ email, otp });

    expect(response.status).toBe(200);
    expect(verifyToken(response.body.token).email).toBe(email);
    const user = await UserModel.findOne({ email });
    expect(user?.otpCode).toBeUndefined();
  });

  it('cannot exchange the same OTP for a second token', async () => {
    await createOtpUser({ email });
    const otp = await loginAndReadOtp();
    await api().post('/api/auth/login/verify-otp').send({ email, otp });

    const replay = await api().post('/api/auth/login/verify-otp').send({ email, otp });

    expect(replay.status).toBe(400);
    expect(replay.body).not.toHaveProperty('token');
  });

  it('rejects an expired OTP', async () => {
    await createOtpUser({ email });
    const otp = await loginAndReadOtp();
    await UserModel.updateOne({ email }, { otpExpiresAt: new Date(Date.now() - 1000) });

    const response = await api().post('/api/auth/login/verify-otp').send({ email, otp });

    expect(response.status).toBe(400);
  });

  it("rejects another user's OTP", async () => {
    await createOtpUser({ email });
    await createOtpUser({ email: 'other@example.com' });
    const otp = await loginAndReadOtp();

    const response = await api()
      .post('/api/auth/login/verify-otp')
      .send({ email: 'other@example.com', otp });

    expect(response.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user without any secret field', async () => {
    const user = await createOtpUser({ email, displayName: 'Alice' });

    const response = await api().get('/api/auth/me').set('Authorization', bearerFor(user));

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(email);
    expect(response.body.displayName).toBe('Alice');
    for (const secret of ['password', 'otpCode', 'resetToken']) {
      expect(response.body).not.toHaveProperty(secret);
    }
  });

  it('hides OTP and reset expiry timestamps while a code is pending', async () => {
    const user = await createOtpUser({ email });
    await api().post('/api/auth/login').send({ email, password: DEFAULT_PASSWORD });
    await api().post('/api/auth/forgot-password').send({ email });

    const response = await api().get('/api/auth/me').set('Authorization', bearerFor(user));

    for (const field of ['password', 'otpCode', 'otpExpiresAt', 'resetToken', 'resetTokenExpiresAt', '__v']) {
      expect(response.body).not.toHaveProperty(field);
    }
  });

  it('requires a token', async () => {
    const response = await api().get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('returns 404 when the token points at a deleted user', async () => {
    const user = await createOtpUser({ email });
    const authorization = bearerFor(user);
    await UserModel.deleteOne({ _id: user._id });

    const response = await api().get('/api/auth/me').set('Authorization', authorization);

    expect(response.status).toBe(404);
  });
});

describe('GET /api/auth/me: avatar fields (ranked duel, phase 2)', () => {
  it('gives a new account the default avatar, no coins and no owned items', async () => {
    const user = await createUser({});
    const response = await api().get('/api/auth/me').set('Authorization', bearerFor(user));

    expect(response.body.avatar).toMatchObject({ skin: 'peach', face: 'classic', hair: 'short-brown', top: 'red', bottom: 'navy', shoes: 'sneakers-brown' });
    expect(response.body.coins).toBe(0);
    expect(response.body.ownedItems).toEqual([]);
  });
});
