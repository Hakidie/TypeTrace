import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../../src/models/user.model';
import { api } from '../helpers/api';
import { DEFAULT_PASSWORD, bearerFor, createUser } from '../helpers/user-factory';

const lock = (actor: { _id: unknown; email: string }, id: unknown, status: 'active' | 'locked' = 'locked') =>
  api().patch(`/api/admin/users/${String(id)}/status`).set('Authorization', bearerFor(actor)).send({ status });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('User status field', () => {
  it('defaults to active without lockedAt', async () => {
    const user = await createUser();
    expect(user.status).toBe('active');
    expect(user.lockedAt).toBeUndefined();
  });

  it('rejects a status outside active/locked', async () => {
    await expect(createUser({ status: 'banned' as never })).rejects.toThrow();
  });
});

describe('PATCH /api/admin/users/:id/status', () => {
  it('locks a user and records lockedAt, then unlocks and clears it', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const learner = await createUser({ email: 'learner@example.com' });

    const locked = await lock(admin, learner._id);
    expect(locked.status).toBe(200);
    expect(locked.body).toMatchObject({ email: 'learner@example.com', status: 'locked' });
    expect(locked.body.lockedAt).toBeTruthy();
    expect(locked.body).not.toHaveProperty('password');

    const unlocked = await lock(admin, learner._id, 'active');
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.status).toBe('active');
    expect((await UserModel.findById(learner._id))?.lockedAt).toBeUndefined();
  });

  it('answers 403 to a learner and 401 without a token', async () => {
    const learner = await createUser();
    const other = await createUser({ email: 'other@example.com' });

    expect((await lock(learner, other._id)).status).toBe(403);
    expect((await api().patch(`/api/admin/users/${String(other._id)}/status`).send({ status: 'locked' })).status).toBe(401);
    expect((await UserModel.findById(other._id))?.status).toBe('active');
  });

  it('answers 400 when an admin locks themselves', async () => {
    const admin = await createUser({ role: 'admin' });
    const response = await lock(admin, admin._id);
    expect(response.status).toBe(400);
    expect((await UserModel.findById(admin._id))?.status).toBe('active');
  });

  it('answers 403 when locking another admin', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const other = await createUser({ email: 'other-admin@example.com', role: 'admin' });
    expect((await lock(admin, other._id)).status).toBe(403);
    expect((await UserModel.findById(other._id))?.status).toBe('active');
  });

  it('answers 404 for an unknown user and 400 for a bad status', async () => {
    const admin = await createUser({ role: 'admin' });
    expect((await lock(admin, '64b000000000000000000000')).status).toBe(404);
    const learner = await createUser({ email: 'learner@example.com' });
    const bad = await api()
      .patch(`/api/admin/users/${String(learner._id)}/status`)
      .set('Authorization', bearerFor(admin))
      .send({ status: 'banned' });
    expect(bad.status).toBe(400);
  });
});

describe('GET /api/admin/users?status=', () => {
  it('filters by status and returns it on each user', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    await createUser({ email: 'locked@example.com', status: 'locked' });
    await createUser({ email: 'fine@example.com' });

    const response = await api().get('/api/admin/users?status=locked').set('Authorization', bearerFor(admin));

    expect(response.status).toBe(200);
    expect(response.body.items.map((user: { email: string }) => user.email)).toEqual(['locked@example.com']);
    expect(response.body.items[0].status).toBe('locked');
  });
});

describe('locked accounts', () => {
  it('cannot log in (403) with the right password, but a wrong password is still 401', async () => {
    await createUser({ email: 'locked@example.com', status: 'locked' });

    const right = await api().post('/api/auth/login').send({ email: 'locked@example.com', password: DEFAULT_PASSWORD });
    expect(right.status).toBe(403);
    expect(right.body).not.toHaveProperty('token');

    const wrong = await api().post('/api/auth/login').send({ email: 'locked@example.com', password: 'wrong-password' });
    expect(wrong.status).toBe(401);
  });

  it('cannot log in with Google', async () => {
    await createUser({ email: 'locked@example.com', status: 'locked' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ aud: 'test-google-client-id', email: 'locked@example.com', email_verified: 'true' })
      }))
    );

    const response = await api().post('/api/auth/google').send({ credential: 'google-id-token' });

    expect(response.status).toBe(403);
    expect(response.body).not.toHaveProperty('token');
  });

  it('are rejected with 403 on a token issued before the lock', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const learner = await createUser({ email: 'learner@example.com' });
    const oldToken = bearerFor(learner);
    expect((await api().get('/api/auth/me').set('Authorization', oldToken)).status).toBe(200);

    await lock(admin, learner._id);

    const response = await api().get('/api/auth/me').set('Authorization', oldToken);
    expect(response.status).toBe(403);
    expect((await api().get('/api/notes').set('Authorization', oldToken)).status).toBe(403);
  });

  it('can log in again and use the old token after an unlock', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const learner = await createUser({ email: 'learner@example.com' });
    await lock(admin, learner._id);
    await lock(admin, learner._id, 'active');

    const login = await api().post('/api/auth/login').send({ email: 'learner@example.com', password: DEFAULT_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    expect((await api().get('/api/auth/me').set('Authorization', bearerFor(learner))).status).toBe(200);
  });
});
