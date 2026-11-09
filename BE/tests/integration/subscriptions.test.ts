import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionModel } from '../../src/models/subscription.model';
import { UserModel } from '../../src/models/user.model';
import {
  getCurrentSubscription,
  grantPremium,
  recordPaidMonth,
  revokePremium
} from '../../src/services/subscription.service';
import { createUser } from '../helpers/user-factory';

const NOW = new Date('2026-01-15T00:00:00Z');
const rows = (userId: unknown) => SubscriptionModel.find({ user: userId as never }).sort({ _id: 1 }).lean();

afterEach(() => vi.useRealTimers());

describe('subscriptions', () => {
  it('gives a new user a free signup row', async () => {
    const user = await createUser();
    const [row, ...others] = await rows(user._id);

    expect(others).toHaveLength(0);
    expect(row).toMatchObject({ plan: 'free', source: 'signup', changedBy: null });
    expect(row.startsAt.getTime()).toBe(user.createdAt.getTime());
  });

  it('reads no row as free', async () => {
    const user = await createUser();
    await SubscriptionModel.deleteMany({});

    expect(await getCurrentSubscription(String(user._id))).toEqual({ plan: 'free', expiresAt: null });
  });

  it('reads an expired premium as free and writes one auto row even when read twice at once', async () => {
    const user = await createUser();
    const expiresAt = new Date('2025-12-01T00:00:00Z');
    await SubscriptionModel.create({ user: user._id, plan: 'premium', startsAt: new Date('2025-11-01T00:00:00Z'), expiresAt, source: 'payment', changedBy: null });

    const reads = await Promise.all([getCurrentSubscription(String(user._id), NOW), getCurrentSubscription(String(user._id), NOW)]);
    await getCurrentSubscription(String(user._id), NOW);

    expect(reads).toEqual([{ plan: 'free', expiresAt: null }, { plan: 'free', expiresAt: null }]);
    const auto = (await rows(user._id)).filter((row) => row.source === 'auto');
    expect(auto).toHaveLength(1);
    expect(auto[0]).toMatchObject({ plan: 'free', changedBy: null });
    expect(auto[0].startsAt.getTime()).toBe(expiresAt.getTime());
  });

  it('reads a premium that has not expired as premium with its expiry', async () => {
    const user = await createUser();
    const expiresAt = new Date('2026-02-01T00:00:00Z');
    await SubscriptionModel.create({ user: user._id, plan: 'premium', startsAt: NOW, expiresAt, source: 'payment', changedBy: null });

    expect(await getCurrentSubscription(String(user._id), NOW)).toEqual({ plan: 'premium', expiresAt });
  });

  it('extends a live premium from its expiry when an admin grants more months', async () => {
    const user = await createUser();
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });

    const first = await grantPremium(String(user._id), 1, String(admin._id), NOW);
    const second = await grantPremium(String(user._id), 2, String(admin._id), NOW);

    expect(first.expiresAt.toISOString()).toBe('2026-02-15T00:00:00.000Z');
    expect(second.expiresAt.toISOString()).toBe('2026-04-15T00:00:00.000Z');
    const granted = (await rows(user._id)).filter((row) => row.source === 'admin');
    expect(granted).toHaveLength(2);
    expect(granted.every((row) => String(row.changedBy) === String(admin._id) && row.plan === 'premium')).toBe(true);
    expect(await getCurrentSubscription(String(user._id), NOW)).toEqual({ plan: 'premium', expiresAt: second.expiresAt });
  });

  it('starts a grant from now when the user has no live premium', async () => {
    const user = await createUser();
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    await SubscriptionModel.create({ user: user._id, plan: 'premium', startsAt: new Date('2025-11-01T00:00:00Z'), expiresAt: new Date('2025-12-01T00:00:00Z'), source: 'payment', changedBy: null });

    const result = await grantPremium(String(user._id), 1, String(admin._id), NOW);

    expect(result.expiresAt.toISOString()).toBe('2026-02-15T00:00:00.000Z');
  });

  it('adds a free admin row when an admin revokes premium', async () => {
    const user = await createUser();
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    await grantPremium(String(user._id), 1, String(admin._id), NOW);

    await revokePremium(String(user._id), String(admin._id));

    expect(await getCurrentSubscription(String(user._id), NOW)).toEqual({ plan: 'free', expiresAt: null });
    const last = (await rows(user._id)).at(-1)!;
    expect(last).toMatchObject({ plan: 'free', source: 'admin' });
    expect(String(last.changedBy)).toBe(String(admin._id));
  });

  it('records a paid month with source payment and no changer', async () => {
    const user = await createUser();

    const result = await recordPaidMonth(String(user._id), 1, NOW);

    expect(result.expiresAt.toISOString()).toBe('2026-02-15T00:00:00.000Z');
    expect((await rows(user._id)).at(-1)).toMatchObject({ plan: 'premium', source: 'payment', changedBy: null });
  });

  it('writes no signup row when a user is only updated', async () => {
    const user = await createUser();
    await UserModel.updateOne({ _id: user._id }, { displayName: 'Changed' });
    const found = await UserModel.findById(user._id);
    found!.displayName = 'Again';
    await found!.save();

    expect(await rows(user._id)).toHaveLength(1);
  });
});
