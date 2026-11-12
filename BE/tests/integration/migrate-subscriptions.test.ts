import { describe, expect, it } from 'vitest';
import { SubscriptionModel } from '../../src/models/subscription.model';
import { migrateSubscriptions } from '../../src/scripts/migrate-subscriptions';
import { createUser } from '../helpers/user-factory';

const rowsOf = (userId: unknown) => SubscriptionModel.find({ user: userId as never }).lean();

describe('migrate:subscriptions', () => {
  it('gives a free migration row to the users without any subscription', async () => {
    const [old, older] = await Promise.all(['old', 'older'].map((name) => createUser({ email: `${name}@example.com` })));
    await SubscriptionModel.deleteMany({ user: { $in: [old._id, older._id] } });

    expect(await migrateSubscriptions()).toMatchObject({ created: 2 });

    const [row, ...others] = await rowsOf(old._id);
    expect(others).toHaveLength(0);
    expect(row).toMatchObject({ plan: 'free', source: 'migration', changedBy: null });
    expect(row.startsAt.getTime()).toBe(old.createdAt.getTime());
  });

  it('does nothing when run twice', async () => {
    const user = await createUser();
    await SubscriptionModel.deleteMany({});

    expect(await migrateSubscriptions()).toMatchObject({ created: 1 });
    expect(await migrateSubscriptions()).toMatchObject({ created: 0 });
    expect(await rowsOf(user._id)).toHaveLength(1);
  });

  it('leaves the users that already have rows alone', async () => {
    const user = await createUser();
    await SubscriptionModel.create({ user: user._id, plan: 'premium', startsAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000), source: 'payment', changedBy: null });

    expect(await migrateSubscriptions()).toMatchObject({ created: 0 });
    expect(await rowsOf(user._id)).toHaveLength(2);
  });

  it('closes the rows of the old model: each row stops where the next one starts, a revoke reads as cancelled', async () => {
    const user = await createUser();
    await SubscriptionModel.deleteMany({});
    const day = (d: string) => new Date(`2026-${d}T00:00:00Z`);
    const [free, extended, premium, revoke] = await SubscriptionModel.create([
      { user: user._id, plan: 'free', startsAt: day('01-01'), source: 'signup', changedBy: null },
      { user: user._id, plan: 'premium', startsAt: day('01-10'), expiresAt: day('02-10'), source: 'admin', changedBy: null },
      // The old model wrote a grant on top of the live term, starting at once.
      { user: user._id, plan: 'premium', startsAt: day('01-20'), expiresAt: day('03-10'), source: 'admin', changedBy: null },
      { user: user._id, plan: 'free', startsAt: day('02-01'), source: 'admin', changedBy: null }
    ]);

    expect(await migrateSubscriptions()).toMatchObject({ closed: 3 });

    const read = async (id: unknown) => (await SubscriptionModel.findById(id as never).lean())!;
    expect((await read(free._id)).endedAt).toEqual(day('01-10'));
    expect((await read(extended._id)).endedAt).toEqual(day('01-20'));
    expect((await read(extended._id)).cancelledAt).toBeUndefined();
    expect((await read(premium._id)).endedAt).toEqual(day('02-01'));
    expect((await read(premium._id)).cancelledAt).toBeDefined();
    expect((await read(revoke._id)).endedAt).toBeUndefined();
    expect(await migrateSubscriptions()).toMatchObject({ closed: 0 });
  });
});
