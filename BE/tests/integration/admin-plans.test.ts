import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSettingModel, DEFAULT_PLANS } from '../../src/models/app-setting.model';
import { PassageModel } from '../../src/models/passage.model';
import { SubscriptionModel } from '../../src/models/subscription.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const NOW = new Date('2026-01-15T00:00:00Z');

beforeEach(async () => {
  await AppSettingModel.init();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const signInAdmin = async () => {
  const admin = await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Admin' });
  return { admin, auth: bearerFor(admin) };
};
const as = (auth: string) => ({
  getPlans: () => api().get('/api/admin/plans').set('Authorization', auth),
  putPlans: (body: object) => api().put('/api/admin/plans').set('Authorization', auth).send(body),
  preview: (body: object) => api().post('/api/admin/plans/preview').set('Authorization', auth).send(body),
  grant: (id: unknown, body: object) => api().post(`/api/admin/users/${id}/premium`).set('Authorization', auth).send(body),
  revoke: (id: unknown) => api().delete(`/api/admin/users/${id}/premium`).set('Authorization', auth),
  users: (query = '') => api().get(`/api/admin/users${query}`).set('Authorization', auth)
});
const plans = (free: Partial<typeof DEFAULT_PLANS.free> = {}, premium: Partial<typeof DEFAULT_PLANS.premium> = {}) => ({
  free: { ...DEFAULT_PLANS.free, ...free },
  premium: { ...DEFAULT_PLANS.premium, ...premium }
});

describe('admin plans', () => {
  it('reads and saves both plans', async () => {
    const { auth } = await signInAdmin();
    const admin = as(auth);

    expect((await admin.getPlans()).body).toEqual(DEFAULT_PLANS);
    const saved = await admin.putPlans(plans({ maxPassages: 5 }, { priceVnd: 150000, canCreateErrorPractice: false }));

    expect(saved.status).toBe(200);
    expect(saved.body.free.maxPassages).toBe(5);
    expect((await admin.getPlans()).body.premium).toMatchObject({ priceVnd: 150000, canCreateErrorPractice: false });
  });

  it('answers 403 to a learner and 401 to a guest', async () => {
    const learner = as(bearerFor(await createUser()));
    const target = await createUser({ email: 'target@example.com' });

    for (const call of [learner.getPlans(), learner.putPlans(plans()), learner.preview(plans()), learner.grant(target._id, { months: 1 }), learner.revoke(target._id)]) {
      expect((await call).status).toBe(403);
    }
    expect((await api().get('/api/admin/plans')).status).toBe(401);
  });

  it('rejects invalid values with 400', async () => {
    const admin = as((await signInAdmin()).auth);

    expect((await admin.putPlans(plans({ maxPassages: -1 }))).status).toBe(400);
    expect((await admin.putPlans(plans({ priceVnd: 1.5 }))).status).toBe(400);
    expect((await admin.putPlans({ free: DEFAULT_PLANS.free })).status).toBe(400);
    expect((await admin.preview(plans({ maxPassages: -1 }))).status).toBe(400);
  });

  it('previews the users and passages that would newly be locked and changes nothing', async () => {
    const admin = as((await signInAdmin()).auth);
    const owner = await createUser({ email: 'owner@example.com' });
    for (let i = 0; i < 5; i += 1) {
      await PassageModel.create({ title: `Bài ${i}`, content: 'chữ chữ', source: 'Tự viết', visibility: 'private', status: 'published', owner: owner._id });
    }

    expect((await admin.preview(plans({ maxPassages: 3 }))).body).toEqual({ lockedUsers: 1, lockedPassages: 2 });
    expect((await admin.preview(plans())).body).toEqual({ lockedUsers: 0, lockedPassages: 0 });
    expect((await admin.getPlans()).body.free.maxPassages).toBe(DEFAULT_PLANS.free.maxPassages);
  });

  it('does not count passages that were already locked in the preview', async () => {
    const admin = as((await signInAdmin()).auth);
    const owner = await createUser({ email: 'owner@example.com' });
    for (let i = 0; i < 5; i += 1) {
      await PassageModel.create({ title: `Bài ${i}`, content: 'chữ chữ', source: 'Tự viết', visibility: 'private', status: 'published', owner: owner._id });
    }
    await admin.putPlans(plans({ maxPassages: 3 }));

    expect((await admin.preview(plans({ maxPassages: 3 }))).body).toEqual({ lockedUsers: 0, lockedPassages: 0 });
    expect((await admin.preview(plans({ maxPassages: 2 }))).body).toEqual({ lockedUsers: 1, lockedPassages: 1 });
  });
});

describe('admin grants of premium', () => {
  it('adds months to a live premium and records the admin', async () => {
    const { admin, auth } = await signInAdmin();
    const user = await createUser({ email: 'user@example.com' });

    const first = await as(auth).grant(user._id, { months: 1 });
    const second = await as(auth).grant(user._id, { months: 2 });

    expect(first.status).toBe(200);
    expect(first.body).toEqual({ plan: 'premium', expiresAt: '2026-02-15T00:00:00.000Z' });
    expect(second.body.expiresAt).toBe('2026-04-15T00:00:00.000Z');
    const rows = await SubscriptionModel.find({ user: user._id, source: 'admin' });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => String(row.changedBy) === String(admin._id))).toBe(true);
  });

  it('refuses 0, 37 and a fractional number of months, and an unknown user', async () => {
    const { auth } = await signInAdmin();
    const user = await createUser({ email: 'user@example.com' });

    for (const months of [0, 37, 1.5, '2']) expect((await as(auth).grant(user._id, { months })).status).toBe(400);
    expect((await as(auth).grant('64b000000000000000000000', { months: 1 })).status).toBe(404);
  });

  it('returns the user to free on revoke and records the admin', async () => {
    const { admin, auth } = await signInAdmin();
    const user = await createUser({ email: 'user@example.com' });
    await as(auth).grant(user._id, { months: 1 });

    const revoked = await as(auth).revoke(user._id);

    expect(revoked.status).toBe(204);
    const last = (await SubscriptionModel.find({ user: user._id }).sort({ _id: -1 }).limit(1))[0];
    expect(last).toMatchObject({ plan: 'free', source: 'admin' });
    expect(String(last.changedBy)).toBe(String(admin._id));
    expect((await as(auth).revoke('64b000000000000000000000')).status).toBe(404);
  });

  it('shows the plan and expiry in the user list and filters by plan', async () => {
    const { auth } = await signInAdmin();
    const premium = await createUser({ email: 'premium@example.com' });
    const free = await createUser({ email: 'free@example.com' });
    const expired = await createUser({ email: 'expired@example.com' });
    await as(auth).grant(premium._id, { months: 1 });
    await SubscriptionModel.create({ user: expired._id, plan: 'premium', startsAt: new Date('2025-11-01T00:00:00Z'), expiresAt: new Date('2025-12-01T00:00:00Z'), source: 'payment', changedBy: null });
    const byEmail = (body: { items: { email: string; plan: string; planExpiresAt: string | null }[] }, email: string) => body.items.find((item) => item.email === email)!;

    const all = (await as(auth).users('?limit=100')).body;
    expect(byEmail(all, 'premium@example.com')).toMatchObject({ plan: 'premium', planExpiresAt: '2026-02-15T00:00:00.000Z' });
    expect(byEmail(all, 'free@example.com')).toMatchObject({ plan: 'free', planExpiresAt: null });
    expect(byEmail(all, 'expired@example.com')).toMatchObject({ plan: 'free', planExpiresAt: null });

    const onlyPremium = (await as(auth).users('?plan=premium')).body;
    expect(onlyPremium.items.map((item: { email: string }) => item.email)).toEqual(['premium@example.com']);
    const onlyFree = (await as(auth).users('?plan=free&limit=100')).body;
    expect(onlyFree.items.map((item: { email: string }) => item.email).sort()).toEqual(['admin@example.com', 'expired@example.com', 'free@example.com']);
    expect((await as(auth).users('?plan=gold')).status).toBe(400);
    expect(String(free._id)).toBeTruthy();
  });
});
