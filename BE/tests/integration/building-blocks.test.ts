import express from 'express';
import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { authGuard } from '../../src/middlewares/auth.middleware';
import { errorMiddleware } from '../../src/middlewares/error.middleware';
import { requireRole } from '../../src/middlewares/role.middleware';
import { UserModel } from '../../src/models/user.model';
import { paginate } from '../../src/utils/pagination';
import { serve } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

describe('paginate', () => {
  it('returns one page of items with totals, sorted', async () => {
    for (let i = 1; i <= 5; i += 1) await createUser({ email: `u${i}@example.com`, displayName: `User ${i}` });

    const page = await paginate(UserModel, {}, { page: 2, limit: 2, sort: 'displayName' });

    expect(page).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(page.items.map((user) => user.displayName)).toEqual(['User 3', 'User 4']);
  });

  it('accepts _id as the sort field', async () => {
    await createUser({ email: 'a@example.com' });
    const page = await paginate(UserModel, {}, { page: 1, limit: 20, sort: '-_id' });
    expect(page.total).toBe(1);
  });

  it('applies the filter to both items and total', async () => {
    await createUser({ email: 'a@example.com', role: 'admin' });
    await createUser({ email: 'b@example.com' });

    const page = await paginate(UserModel, { role: 'admin' }, { page: 1, limit: 20, sort: '-createdAt' });

    expect(page.total).toBe(1);
    expect(page.items[0].email).toBe('a@example.com');
  });

  it('can return only some fields and sort text in the order of a language', async () => {
    for (const [index, displayName] of ['Zoe', 'Đức', 'Dung'].entries()) {
      await createUser({ email: `u${index}@example.com`, displayName });
    }
    const query = { page: 1, limit: 20, sort: 'displayName' };

    const plain = await paginate(UserModel, {}, query);
    const vietnamese = await paginate(UserModel, {}, query, { select: 'displayName', collation: { locale: 'vi' } });

    // Without a collation Đ sorts after Z; in Vietnamese it comes right after D.
    expect(plain.items.map((user) => user.displayName)).toEqual(['Dung', 'Zoe', 'Đức']);
    expect(vietnamese.items.map((user) => user.displayName)).toEqual(['Dung', 'Đức', 'Zoe']);
    expect(vietnamese.items[0].email).toBeUndefined();
    expect(vietnamese.total).toBe(3);
  });

  it('counts with the same collation as the page, so the count can use the index made for it', async () => {
    await createUser({ email: 'a@example.com', displayName: 'Đức' });
    const calls: { method: string; args: unknown[] }[] = [];
    mongoose.set('debug', (_collection: string, method: string, ...args: unknown[]) => calls.push({ method, args }));
    try {
      const page = await paginate(UserModel, {}, { page: 1, limit: 20, sort: 'displayName' }, { collation: { locale: 'vi' } });
      expect(page.total).toBe(1);
    } finally {
      mongoose.set('debug', false);
    }

    const count = calls.find((call) => call.method === 'countDocuments');
    expect(count?.args).toContainEqual(expect.objectContaining({ collation: { locale: 'vi' } }));
  });
});

describe('requireRole', () => {
  const app = express();
  app.get('/admin', authGuard, requireRole('admin'), (req, res) => {
    res.json({ role: req.user?.role });
  });
  app.use(errorMiddleware);
  const client = serve(app);

  it('lets an admin through', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const response = await client().get('/admin').set('Authorization', bearerFor(admin));
    expect(response.status).toBe(200);
    expect(response.body.role).toBe('admin');
  });

  it('answers 403 for a regular user', async () => {
    const user = await createUser({ email: 'user@example.com' });
    const response = await client().get('/admin').set('Authorization', bearerFor(user));
    expect(response.status).toBe(403);
  });

  it('answers 401 for a deleted user', async () => {
    const user = await createUser({ email: 'gone@example.com', role: 'admin' });
    const authorization = bearerFor(user);
    await UserModel.deleteOne({ _id: user._id });
    const response = await client().get('/admin').set('Authorization', authorization);
    expect(response.status).toBe(401);
  });
});
