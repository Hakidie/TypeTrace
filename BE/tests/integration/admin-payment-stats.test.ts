import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentModel } from '../../src/models/payment.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const revenue = (auth: string, query: string) => api().get(`/api/admin/payments/revenue${query}`).set('Authorization', auth);
const base = { orderInfo: 'x', amount: 20_000, product: 'coins-500' as const };

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
afterEach(() => vi.useRealTimers());

describe('GET /api/admin/payments/revenue', () => {
  it('is for admins only', async () => {
    expect((await api().get('/api/admin/payments/revenue')).status).toBe(401);
    expect((await revenue(bearerFor(await createUser({ email: 'u@example.com' })), '')).status).toBe(403);
  });

  it('sums the money of each gateway per period, only for payments that are paid and given', async () => {
    vi.setSystemTime(new Date('2026-02-15T03:00:00Z'));
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const an = await createUser({ email: 'an@example.com' });
    const paid = (over: object, at: string) => PaymentModel.create({ ...base, owner: an._id, status: 'paid', paidAt: new Date(at), grantedAt: new Date(at), ...over });
    await paid({ provider: 'payos', payosOrderCode: 1, amount: 50_000 }, '2026-01-10T03:00:00Z');
    await paid({ provider: 'payos', payosOrderCode: 2, amount: 20_000 }, '2026-01-20T03:00:00Z');
    await paid({ provider: 'vnpay', amount: 100_000 }, '2026-02-01T03:00:00Z');
    // No provider is VNPay's.
    await paid({ amount: 5_000 }, '2026-02-02T03:00:00Z');
    await paid({ provider: 'momo', amount: 30_000 }, '2026-02-10T03:00:00Z');
    // Not counted: paid but not given, pending, failed.
    await PaymentModel.create({ ...base, owner: an._id, provider: 'momo', status: 'paid', paidAt: new Date('2026-02-10T03:00:00Z'), amount: 999_000 });
    await PaymentModel.create({ ...base, owner: an._id, provider: 'momo', status: 'pending', amount: 888_000 });
    await PaymentModel.create({ ...base, owner: an._id, provider: 'momo', status: 'failed', amount: 777_000 });

    const res = await revenue(bearerFor(admin), '?range=year&date=2026-02-15');

    expect(res.status).toBe(200);
    expect(res.body.range).toBe('year');
    expect(res.body.points).toEqual([
      { key: '2026-01', payos: 70_000, vnpay: 0, momo: 0 },
      { key: '2026-02', payos: 0, vnpay: 105_000, momo: 30_000 }
    ]);
  });

  it('cuts the days at midnight in Vietnam and leaves out the periods to come', async () => {
    vi.setSystemTime(new Date('2026-02-03T10:00:00Z'));
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const an = await createUser({ email: 'an@example.com' });
    // 2 February 20:00 UTC is already 3 February in Vietnam.
    await PaymentModel.create({ ...base, owner: an._id, provider: 'payos', payosOrderCode: 1, status: 'paid', paidAt: new Date('2026-02-02T20:00:00Z'), grantedAt: new Date(), amount: 40_000 });

    const res = await revenue(bearerFor(admin), '?range=week&date=2026-02-03');

    expect(res.body.points.map((point: { key: string; payos: number }) => [point.key, point.payos])).toEqual([
      ['2026-02-01', 0],
      ['2026-02-02', 0],
      ['2026-02-03', 40_000]
    ]);
  });
});
