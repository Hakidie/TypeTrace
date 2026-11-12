import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionModel } from '../../src/models/subscription.model';
import { UserModel } from '../../src/models/user.model';
import {
  cancelPremium,
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

  it('queues more months after the last term when an admin grants again', async () => {
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

    await revokePremium(String(user._id), String(admin._id), NOW);

    expect(await getCurrentSubscription(String(user._id), NOW)).toEqual({ plan: 'free', expiresAt: null });
    const last = (await rows(user._id)).at(-1)!;
    expect(last).toMatchObject({ plan: 'free', source: 'admin' });
    expect(String(last.changedBy)).toBe(String(admin._id));
  });

  it('starts the next grant when the last term ends, so every term keeps its own dates', async () => {
    const user = await createUser();
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    await grantPremium(String(user._id), 1, String(admin._id), NOW);
    await grantPremium(String(user._id), 1, String(admin._id), NOW);

    const terms = (await rows(user._id)).filter((row) => row.plan === 'premium');
    expect(terms.map((row) => [row.startsAt.toISOString(), row.expiresAt!.toISOString()])).toEqual([
      ['2026-01-15T00:00:00.000Z', '2026-02-15T00:00:00.000Z'],
      ['2026-02-15T00:00:00.000Z', '2026-03-15T00:00:00.000Z']
    ]);
    // The queued term takes over by itself when the first one ends, without an auto row.
    const later = new Date('2026-02-20T00:00:00Z');
    expect(await getCurrentSubscription(String(user._id), later)).toEqual({ plan: 'premium', expiresAt: new Date('2026-03-15T00:00:00Z') });
    expect((await rows(user._id)).filter((row) => row.source === 'auto')).toHaveLength(0);
  });

  it('closes the free row when premium starts', async () => {
    const user = await createUser();
    await grantPremium(String(user._id), 1, undefined as never, NOW);

    const free = (await rows(user._id)).find((row) => row.plan === 'free')!;
    expect(free.endedAt?.toISOString()).toBe(NOW.toISOString());
  });

  it('cancels at the end of the last term: premium stays until then, then the user is free', async () => {
    const user = await createUser();
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    await grantPremium(String(user._id), 1, String(admin._id), NOW);
    await grantPremium(String(user._id), 1, String(admin._id), NOW);

    await cancelPremium(String(user._id), NOW);

    const terms = (await rows(user._id)).filter((row) => row.plan === 'premium');
    expect(terms[0].cancelledAt).toBeUndefined();
    expect(terms[1].cancelledAt?.toISOString()).toBe(NOW.toISOString());
    expect(await getCurrentSubscription(String(user._id), new Date('2026-03-01T00:00:00Z'))).toMatchObject({ plan: 'premium' });
    expect(await getCurrentSubscription(String(user._id), new Date('2026-03-20T00:00:00Z'))).toEqual({ plan: 'free', expiresAt: null });
    const auto = (await rows(user._id)).find((row) => row.source === 'auto')!;
    expect(auto.startsAt.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('refuses to cancel a user without premium', async () => {
    const user = await createUser();

    await expect(cancelPremium(String(user._id), NOW)).rejects.toMatchObject({ status: 400 });
  });

  it('takes the cancel back when more months are granted', async () => {
    const user = await createUser();
    await grantPremium(String(user._id), 1, undefined as never, NOW);
    await cancelPremium(String(user._id), NOW);

    await grantPremium(String(user._id), 1, undefined as never, NOW);

    const terms = (await rows(user._id)).filter((row) => row.plan === 'premium');
    expect(terms.map((row) => row.cancelledAt)).toEqual([undefined, undefined]);
  });

  it('revokes at once: the running term stops now and the terms not started never start', async () => {
    const user = await createUser();
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    await grantPremium(String(user._id), 1, String(admin._id), NOW);
    await grantPremium(String(user._id), 1, String(admin._id), NOW);
    const now = new Date('2026-01-20T00:00:00Z');

    await revokePremium(String(user._id), String(admin._id), now);

    const [running, queued] = (await rows(user._id)).filter((row) => row.plan === 'premium');
    expect([running.endedAt?.toISOString(), running.cancelledAt?.toISOString()]).toEqual([now.toISOString(), now.toISOString()]);
    expect([queued.endedAt?.toISOString(), queued.cancelledAt?.toISOString()]).toEqual(['2026-02-15T00:00:00.000Z', now.toISOString()]);
    expect(await getCurrentSubscription(String(user._id), new Date('2026-03-01T00:00:00Z'))).toEqual({ plan: 'free', expiresAt: null });
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
