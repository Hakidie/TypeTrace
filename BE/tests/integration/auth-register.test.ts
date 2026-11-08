import { describe, expect, it } from 'vitest';
import { api } from '../helpers/api';
import { UserModel } from '../../src/models/user.model';
import { emailOutbox, lastEmailTo } from '../helpers/email-outbox';
import { createUser, readSecrets } from '../helpers/user-factory';

const validPayload = { email: 'new@example.com', password: 'Passw0rd!' };

describe('POST /api/auth/register', () => {
  it('creates an unverified user, stores an OTP and emails it', async () => {
    const response = await api().post('/api/auth/register').send(validPayload);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ message: 'OTP has been sent to your email' });

    const user = await UserModel.findOne({ email: validPayload.email });
    expect(user?.isEmailVerified).toBe(false);
    expect(user?.otpCode).toMatch(/^\d{6}$/);
    expect(user?.otpExpiresAt?.getTime()).toBeGreaterThan(Date.now());

    const mail = lastEmailTo(validPayload.email);
    expect(mail?.html).toContain(user?.otpCode as string);
  });

  it('never returns the OTP in the response body', async () => {
    const response = await api().post('/api/auth/register').send(validPayload);
    const { otpCode } = await readSecrets(validPayload.email);
    expect(JSON.stringify(response.body)).not.toContain(otpCode as string);
  });

  it('stores the email lowercased', async () => {
    await api().post('/api/auth/register').send({ ...validPayload, email: 'MiXeD@Example.COM' });
    expect(await UserModel.findOne({ email: 'mixed@example.com' })).not.toBeNull();
  });

  it('rejects a duplicate email with 409', async () => {
    await createUser({ email: validPayload.email });

    const response = await api().post('/api/auth/register').send(validPayload);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Email already exists');
    expect(emailOutbox).toHaveLength(0);
  });

  it('rejects an invalid payload with 400 before touching the database', async () => {
    const response = await api()
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: '123' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    expect(await UserModel.countDocuments()).toBe(0);
  });
});

describe('POST /api/auth/register/verify-otp', () => {
  const registerAndReadOtp = async () => {
    await api().post('/api/auth/register').send(validPayload);
    const { otpCode } = await readSecrets(validPayload.email);
    return otpCode as string;
  };

  it('verifies the email and clears the OTP', async () => {
    const otp = await registerAndReadOtp();

    const response = await api()
      .post('/api/auth/register/verify-otp')
      .send({ email: validPayload.email, otp });

    expect(response.status).toBe(200);
    const user = await UserModel.findOne({ email: validPayload.email });
    expect(user?.isEmailVerified).toBe(true);
    expect(user?.otpCode).toBeUndefined();
    expect(user?.otpExpiresAt).toBeUndefined();
  });

  it('cannot reuse the same OTP twice', async () => {
    const otp = await registerAndReadOtp();
    await api().post('/api/auth/register/verify-otp').send({ email: validPayload.email, otp });

    const replay = await api()
      .post('/api/auth/register/verify-otp')
      .send({ email: validPayload.email, otp });

    expect(replay.status).toBe(400);
    expect(replay.body.message).toBe('Invalid or expired OTP');
  });

  it('rejects a wrong OTP', async () => {
    const otp = await registerAndReadOtp();
    const wrongOtp = otp === '000000' ? '111111' : '000000';

    const response = await api()
      .post('/api/auth/register/verify-otp')
      .send({ email: validPayload.email, otp: wrongOtp });

    expect(response.status).toBe(400);
    expect((await UserModel.findOne({ email: validPayload.email }))?.isEmailVerified).toBe(false);
  });

  it('rejects an expired OTP', async () => {
    const otp = await registerAndReadOtp();
    await UserModel.updateOne(
      { email: validPayload.email },
      { otpExpiresAt: new Date(Date.now() - 1000) }
    );

    const response = await api()
      .post('/api/auth/register/verify-otp')
      .send({ email: validPayload.email, otp });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid or expired OTP');
  });

  it('rejects an unknown email without leaking that it is unknown', async () => {
    const response = await api()
      .post('/api/auth/register/verify-otp')
      .send({ email: 'ghost@example.com', otp: '123456' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid or expired OTP');
  });
});

describe('GET /api/auth/email-exists', () => {
  it('says false for an email nobody uses', async () => {
    const response = await api().get('/api/auth/email-exists').query({ email: 'free@example.com' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ exists: false });
  });

  it('says true for an email that has an account, and nothing else', async () => {
    await createUser({ email: 'taken@example.com' });

    const response = await api().get('/api/auth/email-exists').query({ email: 'taken@example.com' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ exists: true });
  });

  it('rejects a missing or malformed email', async () => {
    expect((await api().get('/api/auth/email-exists')).status).toBe(400);
    expect((await api().get('/api/auth/email-exists').query({ email: 'nope' })).status).toBe(400);
  });
});
