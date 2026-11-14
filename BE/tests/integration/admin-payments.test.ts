import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaymentModel } from '../../src/models/payment.model';
import { getCurrentSubscription } from '../../src/services/subscription.service';
import { UserModel } from '../../src/models/user.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

afterEach(() => vi.restoreAllMocks());

const list = (auth: string, query = '') => api().get(`/api/admin/payments${query}`).set('Authorization', auth);
const recheck = (auth: string, id: unknown) => api().post(`/api/admin/payments/${id}/recheck`).set('Authorization', auth);
const base = { orderInfo: 'x', amount: 20_000, product: 'coins-500' as const };

describe('GET /api/admin/payments', () => {
  it('is for admins only', async () => {
    expect((await api().get('/api/admin/payments')).status).toBe(401);
    expect((await list(bearerFor(await createUser({ email: 'u@example.com' })))).status).toBe(403);
  });

  it('lists the payments of all users, newest first, with the buyer and whether they got what they bought', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const an = await createUser({ email: 'an@example.com', displayName: 'An' });
    await PaymentModel.create({ ...base, owner: an._id, provider: 'vnpay', status: 'paid', paidAt: new Date(), grantedAt: new Date() });
    await PaymentModel.create({ ...base, owner: an._id, provider: 'payos', payosOrderCode: 1, status: 'pending' });

    const res = await list(bearerFor(admin));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items[0]).toMatchObject({ userName: 'An', email: 'an@example.com', provider: 'payos', status: 'pending', granted: false, amount: 20_000 });
    expect(res.body.items[1]).toMatchObject({ provider: 'vnpay', status: 'paid', granted: true });
    expect(JSON.stringify(res.body)).not.toMatch(/payosOrderCode|owner|password/);
  });

  it('filters by status, by provider (a payment without one is VNPay) and by buyer', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const an = await createUser({ email: 'an@example.com', displayName: 'An' });
    const binh = await createUser({ email: 'binh@example.com', displayName: 'Binh' });
    await PaymentModel.create({ ...base, owner: an._id, status: 'paid' });
    await PaymentModel.create({ ...base, owner: an._id, provider: 'momo', status: 'failed' });
    await PaymentModel.create({ ...base, owner: binh._id, provider: 'payos', payosOrderCode: 2, status: 'pending' });
    const auth = bearerFor(admin);

    expect((await list(auth, '?status=failed')).body.items).toHaveLength(1);
    expect((await list(auth, '?provider=vnpay')).body.items).toHaveLength(1);
    expect((await list(auth, '?provider=payos')).body.items[0]).toMatchObject({ userName: 'Binh' });
    expect((await list(auth, '?q=an%40')).body.items).toHaveLength(2);
    expect((await list(auth, '?sort=password')).status).toBe(400);
  });
});

describe('POST /api/admin/payments/:id/recheck', () => {
  const payosSays = (status: string, amount: number) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: '00', data: { status, amount, paymentLinkId: 'l1' } }));

  it('asks payOS again and gives what was bought when the payment was made', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const an = await createUser({ email: 'an@example.com' });
    const payment = await PaymentModel.create({ ...base, owner: an._id, provider: 'payos', payosOrderCode: 3, status: 'pending' });
    payosSays('PAID', 20_000);

    const res = await recheck(bearerFor(admin), payment._id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'paid', granted: true });
    expect((await UserModel.findById(an._id))!.coins).toBe(500);
  });

  it('gives a paid payment whose give failed before', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const an = await createUser({ email: 'an@example.com' });
    const payment = await PaymentModel.create({ ...base, product: 'premium-1m', amount: 99_000, owner: an._id, provider: 'payos', payosOrderCode: 4, status: 'paid', paidAt: new Date() });

    const res = await recheck(bearerFor(admin), payment._id);

    expect(res.body).toMatchObject({ status: 'paid', granted: true });
    expect((await getCurrentSubscription(String(an._id))).plan).toBe('premium');
  });

  it('leaves a payment pending when payOS still shows it open, and closes one payOS cancelled', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const an = await createUser({ email: 'an@example.com' });
    const open = await PaymentModel.create({ ...base, owner: an._id, provider: 'payos', payosOrderCode: 5, status: 'pending' });
    payosSays('PENDING', 20_000);
    expect((await recheck(bearerFor(admin), open._id)).body.status).toBe('pending');
    payosSays('CANCELLED', 20_000);
    expect((await recheck(bearerFor(admin), open._id)).body.status).toBe('failed');
    expect((await UserModel.findById(an._id))!.coins).toBe(0);
  });

  it('refuses a payment that is not payOS, one with nothing to check, an unknown one and a non-admin', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const an = await createUser({ email: 'an@example.com' });
    const vnpay = await PaymentModel.create({ ...base, owner: an._id, provider: 'vnpay', status: 'pending' });
    const done = await PaymentModel.create({ ...base, owner: an._id, provider: 'payos', payosOrderCode: 6, status: 'paid', grantedAt: new Date() });
    const auth = bearerFor(admin);

    expect((await recheck(auth, vnpay._id)).status).toBe(400);
    expect((await recheck(auth, done._id)).status).toBe(400);
    expect((await recheck(auth, '0'.repeat(24))).status).toBe(404);
    expect((await recheck(bearerFor(an), done._id)).status).toBe(403);
  });
});
