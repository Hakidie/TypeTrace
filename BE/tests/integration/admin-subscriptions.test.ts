import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { grantPremium, recordPaidMonth, revokePremium } from '../../src/services/subscription.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const NOW = new Date('2026-01-15T00:00:00Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const list = (auth: string, query = '') => api().get(`/api/admin/subscriptions${query}`).set('Authorization', auth);

describe('GET /api/admin/subscriptions', () => {
  it('lists every plan change with the user and the admin who made it, newest first', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Boss' });
    const learner = await createUser({ email: 'an@example.com', displayName: 'An' });
    await grantPremium(String(learner._id), 2, String(admin._id));

    const res = await list(bearerFor(admin));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, total: 3, totalPages: 1 });
    // Sign-up rows of the admin and the learner, then the grant (the newest is first).
    expect(res.body.items[0]).toMatchObject({ userName: 'An', plan: 'premium', source: 'admin', changedByName: 'Boss' });
    expect(res.body.items[0].expiresAt).toBe('2026-03-15T00:00:00.000Z');
    const signup = res.body.items.find((item: { userName: string; source: string }) => item.userName === 'An' && item.source === 'signup');
    expect(signup).toMatchObject({ plan: 'free', changedByName: null, expiresAt: null });
  });

  it('names a user by display name, and by email only when they have none; never an id or a password', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Boss' });
    const named = await createUser({ email: 'named@example.com', displayName: 'An' });
    const unnamed = await createUser({ email: 'unnamed@example.com' });
    await revokePremium(String(named._id), String(admin._id));

    const res = await list(bearerFor(admin));
    const text = JSON.stringify(res.body);

    expect(text).not.toContain('"named@example.com"');
    expect(res.body.items.map((item: { userName: string }) => item.userName)).toContain('unnamed@example.com');
    expect(text).not.toContain(String(unnamed._id));
    expect(text).not.toMatch(/password|admin@example\.com/);
  });

  it('filters by plan, by payment method and by who changed it, and searches the user name', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Boss' });
    const an = await createUser({ email: 'an@example.com', displayName: 'An' });
    await createUser({ email: 'binh@example.com', displayName: 'Binh' });
    await grantPremium(String(an._id), 1, String(admin._id));
    await recordPaidMonth(String(an._id), 1);
    const auth = bearerFor(admin);

    expect((await list(auth, '?plan=premium')).body.total).toBe(2);
    // No payment method: every row that was not a payment (sign-ups and the admin's grant).
    expect((await list(auth, '?method=none')).body.total).toBe(4);
    expect((await list(auth, '?by=admin')).body.items.map((item: { source: string }) => item.source)).toEqual(['admin']);
    expect((await list(auth, '?by=system')).body.total).toBe(4);
    const found = await list(auth, '?q=binh');
    expect(found.body.items.map((item: { userName: string }) => item.userName)).toEqual(['Binh']);
  });

  it('pages the list and rejects a sort it does not allow', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    await createUser({ email: 'a@example.com' });
    await createUser({ email: 'b@example.com' });
    const auth = bearerFor(admin);

    const page = await list(auth, '?limit=2&page=2');
    expect(page.body).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(page.body.items).toHaveLength(1);
    expect((await list(auth, '?sort=user')).status).toBe(400);
  });

  it('answers 403 to a learner and 401 to a guest', async () => {
    const learner = await createUser();
    expect((await list(bearerFor(learner))).status).toBe(403);
    expect((await api().get('/api/admin/subscriptions')).status).toBe(401);
  });
});
