import { describe, expect, it } from 'vitest';
import { UserModel } from '../../src/models/user.model';
import { migrateUserStatus } from '../../src/scripts/migrate-user-status';
import { createUser } from '../helpers/user-factory';

const statusOf = async (id: unknown) => (await UserModel.collection.findOne({ _id: id as never }))!.status;

describe('migrate:user-status', () => {
  it('gives `active` to the accounts saved before the status existed, leaves the others alone, and does nothing on a second run', async () => {
    const [old, nullStatus, active, locked] = await Promise.all(
      ['old', 'null', 'active', 'locked'].map((name) => createUser({ email: `${name}@example.com`, status: name === 'locked' ? 'locked' : 'active' }))
    );
    await UserModel.collection.updateOne({ _id: old._id }, { $unset: { status: '' } });
    await UserModel.collection.updateOne({ _id: nullStatus._id }, { $set: { status: null } });

    expect(await migrateUserStatus()).toEqual({ updated: 2 });

    expect(await statusOf(old._id)).toBe('active');
    expect(await statusOf(nullStatus._id)).toBe('active');
    expect(await statusOf(active._id)).toBe('active');
    expect(await statusOf(locked._id)).toBe('locked');
    expect(await migrateUserStatus()).toEqual({ updated: 0 });
  });
});
