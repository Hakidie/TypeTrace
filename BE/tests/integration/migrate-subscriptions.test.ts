import { describe, expect, it } from 'vitest';
import { SubscriptionModel } from '../../src/models/subscription.model';
import { migrateSubscriptions } from '../../src/scripts/migrate-subscriptions';
import { createUser } from '../helpers/user-factory';

const rowsOf = (userId: unknown) => SubscriptionModel.find({ user: userId as never }).lean();

describe('migrate:subscriptions', () => {
  it('gives a free migration row to the users without any subscription', async () => {
    const [old, older] = await Promise.all(['old', 'older'].map((name) => createUser({ email: `${name}@example.com` })));
    await SubscriptionModel.deleteMany({ user: { $in: [old._id, older._id] } });

    expect(await migrateSubscriptions()).toEqual({ created: 2 });

    const [row, ...others] = await rowsOf(old._id);
    expect(others).toHaveLength(0);
    expect(row).toMatchObject({ plan: 'free', source: 'migration', changedBy: null });
    expect(row.startsAt.getTime()).toBe(old.createdAt.getTime());
  });

  it('does nothing when run twice', async () => {
    const user = await createUser();
    await SubscriptionModel.deleteMany({});

    expect(await migrateSubscriptions()).toEqual({ created: 1 });
    expect(await migrateSubscriptions()).toEqual({ created: 0 });
    expect(await rowsOf(user._id)).toHaveLength(1);
  });

  it('leaves the users that already have rows alone', async () => {
    const user = await createUser();
    await SubscriptionModel.create({ user: user._id, plan: 'premium', startsAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000), source: 'payment', changedBy: null });

    expect(await migrateSubscriptions()).toEqual({ created: 0 });
    expect(await rowsOf(user._id)).toHaveLength(2);
  });
});
