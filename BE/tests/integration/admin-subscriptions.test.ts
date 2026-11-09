import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../../src/models/user.model';
import { cancelPremium, grantPremium, recordPaidMonth, revokePremium } from '../../src/services/subscription.service';
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
    expect(res.body.items[0].endsAt).toBe('2026-03-15T00:00:00.000Z');
    const signup = res.body.items.find((item: { userName: string; source: string }) => item.userName === 'An' && item.source === 'signup');
    expect(signup).toMatchObject({ plan: 'free', changedByName: null, endsAt: '2026-01-15T00:00:00.000Z' });
  });

  it('names a user by display name, and by email only when they have none; gives the email apart; never an id or a password', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Boss' });
    const named = await createUser({ email: 'named@example.com', displayName: 'An' });
    const unnamed = await createUser({ email: 'unnamed@example.com' });
    await revokePremium(String(named._id), String(admin._id));

    const res = await list(bearerFor(admin));
    const text = JSON.stringify(res.body);
    const of = (email: string) => res.body.items.find((item: { email: string }) => item.email === email);

    expect(of('named@example.com')).toMatchObject({ userName: 'An', email: 'named@example.com' });
    expect(of('unnamed@example.com')).toMatchObject({ userName: 'unnamed@example.com', email: 'unnamed@example.com' });
    expect(text).not.toContain(String(unnamed._id));
    expect(text).not.toMatch(/password/);
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

  it('gives every row its period and status, and filters by status', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Boss' });
    const an = await createUser({ email: 'an@example.com', displayName: 'An' });
    const binh = await createUser({ email: 'binh@example.com', displayName: 'Binh' });
    await grantPremium(String(an._id), 1, String(admin._id), NOW);
    await grantPremium(String(an._id), 1, String(admin._id), NOW);
    await grantPremium(String(binh._id), 1, String(admin._id), NOW);
    await cancelPremium(String(binh._id), NOW);
    const auth = bearerFor(admin);
    const premium = async (status: string) => (await list(auth, `?plan=premium&status=${status}`)).body.items.map((item: { userName: string }) => item.userName);

    const items = (await list(auth, '?plan=premium&sort=startsAt')).body.items;
    expect(items.map((item: { userName: string; status: string; endsAt: string }) => [item.userName, item.status, item.endsAt])).toEqual([
      ['An', 'active', '2026-02-15T00:00:00.000Z'],
      ['Binh', 'cancelled', '2026-02-15T00:00:00.000Z'],
      ['An', 'upcoming', '2026-03-15T00:00:00.000Z']
    ]);
    expect(await premium('active')).toEqual(['An']);
    expect(await premium('upcoming')).toEqual(['An']);
    expect(await premium('cancelled')).toEqual(['Binh']);
    expect(await premium('ended')).toEqual([]);
    // The Free rows of the three people were closed when Premium started: they ended.
    expect((await list(auth, '?plan=free&status=ended')).body.total).toBe(2);
    expect((await list(auth, '?plan=free&status=active')).body.total).toBe(1);
    expect((await list(auth, '?status=gold')).status).toBe(400);
  });

  it('gives each row the avatar of its user: the picture they show, else the pixel avatar', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Boss' });
    await createUser({ email: 'pic@example.com', displayName: 'Pic', avatarUrl: 'https://img.example.com/pic.png' });
    const pix = await createUser({ email: 'pix@example.com', displayName: 'Pix', avatarUrl: 'https://img.example.com/pix.png' });
    await UserModel.updateOne({ _id: pix._id }, { avatarSource: 'pixel' });

    const items = (await list(bearerFor(admin), '?q=pi')).body.items;
    const of = (name: string) => items.find((item: { userName: string }) => item.userName === name);

    expect(of('Pic').avatarUrl).toBe('https://img.example.com/pic.png');
    expect(of('Pix').avatarUrl).toBeNull();
    expect(of('Pix').avatar).toHaveProperty('skin');
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
