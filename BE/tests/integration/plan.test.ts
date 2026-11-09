import { describe, expect, it } from 'vitest';
import { DEFAULT_PLANS } from '../../src/models/app-setting.model';
import { PassageModel } from '../../src/models/passage.model';
import { SubscriptionModel } from '../../src/models/subscription.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const getPlan = (auth: string) => api().get('/api/plan').set('Authorization', auth);

describe('GET /api/plan', () => {
  it('needs a signed-in user', async () => {
    expect((await api().get('/api/plan')).status).toBe(401);
  });

  it('shows a new learner as free with nothing used of the free limit', async () => {
    const response = await getPlan(bearerFor(await createUser()));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      plan: 'free',
      expiresAt: null,
      maxPassages: DEFAULT_PLANS.free.maxPassages,
      usedPassages: 0,
      canUsePublicPassages: false,
      canCreateErrorPractice: false,
      plans: DEFAULT_PLANS
    });
  });

  it('counts the passages used and shows the expiry of a premium learner', async () => {
    const me = await createUser();
    const expiresAt = new Date(Date.now() + 10 * 86_400_000);
    await SubscriptionModel.create({ user: me._id, plan: 'premium', startsAt: new Date(), expiresAt, source: 'admin', changedBy: null });
    await PassageModel.create({ title: 'Bài', content: 'chữ chữ', source: 'Tự viết', visibility: 'private', status: 'published', owner: me._id });

    const response = await getPlan(bearerFor(me));

    expect(response.body).toMatchObject({
      plan: 'premium',
      expiresAt: expiresAt.toISOString(),
      maxPassages: DEFAULT_PLANS.premium.maxPassages,
      usedPassages: 1,
      canUsePublicPassages: true,
      canCreateErrorPractice: true
    });
  });

  it('reads an expired premium as free', async () => {
    const me = await createUser();
    await SubscriptionModel.create({ user: me._id, plan: 'premium', startsAt: new Date(Date.now() - 40 * 86_400_000), expiresAt: new Date(Date.now() - 86_400_000), source: 'payment', changedBy: null });

    const response = await getPlan(bearerFor(me));

    expect(response.body).toMatchObject({ plan: 'free', expiresAt: null, maxPassages: DEFAULT_PLANS.free.maxPassages });
  });

  it('sends both plans with their price, to show them next to each other', async () => {
    const response = await getPlan(bearerFor(await createUser()));

    expect(response.body.plans).toEqual(DEFAULT_PLANS);
    expect(response.body.plans.premium.priceVnd).toBe(DEFAULT_PLANS.premium.priceVnd);
  });

  it('never sends an email or who granted the plan', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const me = await createUser();
    await SubscriptionModel.create({ user: me._id, plan: 'premium', startsAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000), source: 'admin', changedBy: admin._id });

    const text = JSON.stringify((await getPlan(bearerFor(me))).body);

    expect(text).not.toContain('admin@example.com');
    expect(text).not.toContain('changedBy');
  });
});
