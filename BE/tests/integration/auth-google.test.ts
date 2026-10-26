import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../helpers/api';
import { UserModel } from '../../src/models/user.model';
import { verifyToken } from '../../src/utils/jwt';
import { createUser } from '../helpers/user-factory';

const email = 'google.user@example.com';

const stubGoogle = (info: Record<string, unknown>, ok = true) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => info })));

const validInfo = { aud: 'test-google-client-id', email, email_verified: 'true' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/auth/google', () => {
  it('creates a verified user and returns a token for a new Google email', async () => {
    stubGoogle(validInfo);

    const response = await api().post('/api/auth/google').send({ credential: 'google-id-token' });

    expect(response.status).toBe(200);
    expect(verifyToken(response.body.token).email).toBe(email);
    // A new account: the app asks the new learner to take the placement test (SCRUM-157).
    expect(response.body.isNewUser).toBe(true);
    const user = await UserModel.findOne({ email });
    expect(user?.isEmailVerified).toBe(true);
    expect(user?.role).toBe('user');
  });

  it('logs in an existing user instead of creating a second one', async () => {
    await createUser({ email });
    stubGoogle(validInfo);

    const response = await api().post('/api/auth/google').send({ credential: 'google-id-token' });

    expect(response.status).toBe(200);
    expect(response.body.isNewUser).toBe(false);
    expect(await UserModel.countDocuments({ email })).toBe(1);
  });

  it('rejects a token issued for another app', async () => {
    stubGoogle({ ...validInfo, aud: 'someone-elses-client-id' });
    const response = await api().post('/api/auth/google').send({ credential: 'google-id-token' });
    expect(response.status).toBe(401);
  });

  it('rejects an unverified Google email', async () => {
    stubGoogle({ ...validInfo, email_verified: 'false' });
    const response = await api().post('/api/auth/google').send({ credential: 'google-id-token' });
    expect(response.status).toBe(401);
    expect(await UserModel.countDocuments({ email })).toBe(0);
  });

  it('rejects a credential Google does not accept', async () => {
    stubGoogle({}, false);
    const response = await api().post('/api/auth/google').send({ credential: 'bad' });
    expect(response.status).toBe(401);
  });

  it('requires a credential', async () => {
    const response = await api().post('/api/auth/google').send({});
    expect(response.status).toBe(400);
  });
});
