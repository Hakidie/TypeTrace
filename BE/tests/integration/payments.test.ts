import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../src/config/env';
import { PAYMENT_PRODUCTS, PaymentProduct } from '../../src/config/payment';
import { PRO_ITEMS } from '../../src/data/avatar-catalog';
import { PaymentModel } from '../../src/models/payment.model';
import { UserModel } from '../../src/models/user.model';
import { signMomoCreate, signMomoResult } from '../../src/utils/momo';
import { signVnpay, verifyVnpay } from '../../src/utils/vnpay';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const SECRET = 'test-vnpay-secret';
const DAY = 86_400_000;

const startPayment = async (product: PaymentProduct = 'pro-6m', user?: Awaited<ReturnType<typeof createUser>>) => {
  const owner = user ?? (await createUser({}));
  const response = await api().post('/api/payments/vnpay').set('Authorization', bearerFor(owner)).send({ product });
  return { user: owner, response };
};

/** What VNPay appends to the return URL and the IPN call, signed like VNPay does. */
const vnpayAnswer = (paymentId: string, product: PaymentProduct, overrides: Record<string, string> = {}) => {
  const params: Record<string, string> = {
    vnp_TxnRef: paymentId,
    vnp_Amount: String(PAYMENT_PRODUCTS[product].amount * 100),
    vnp_ResponseCode: '00',
    vnp_TransactionStatus: '00',
    vnp_TransactionNo: '14000001',
    ...overrides
  };
  return { ...params, vnp_SecureHash: signVnpay(params, SECRET) };
};

const reload = (id: unknown) => UserModel.findById(id);

afterEach(() => vi.restoreAllMocks());

describe('GET /api/payments/products', () => {
  it('needs a signed-in user and sends the catalog from the server', async () => {
    expect((await api().get('/api/payments/products')).status).toBe(401);

    const auth = bearerFor(await createUser({}));
    const response = await api().get('/api/payments/products').set('Authorization', auth);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(Object.keys(PAYMENT_PRODUCTS).length);
    expect(response.body).toContainEqual({ id: 'pro-6m', amount: 249_000, grant: { kind: 'pro', days: 180 } });
    expect(response.body).toContainEqual({ id: 'coins-1400', amount: 50_000, grant: { kind: 'coins', coins: 1400 } });
  });
});

describe('POST /api/payments/vnpay', () => {
  it('needs a signed-in user', async () => {
    expect((await api().post('/api/payments/vnpay').send({ product: 'pro-6m' })).status).toBe(401);
  });

  it('rejects an unknown product (the price is never taken from the client)', async () => {
    const auth = bearerFor(await createUser({}));
    const response = await api().post('/api/payments/vnpay').set('Authorization', auth).send({ product: 'free', amount: 1 });
    expect(response.status).toBe(400);
  });

  it('saves a pending payment and returns a signed VNPay url', async () => {
    const { user, response } = await startPayment('pro-6m');

    expect(response.status).toBe(201);
    const payment = await PaymentModel.findById(response.body.paymentId);
    expect(payment).toMatchObject({ product: 'pro-6m', amount: 249_000, status: 'pending' });
    expect(String(payment!.owner)).toBe(String(user._id));

    const url = new URL(response.body.paymentUrl);
    expect(url.origin + url.pathname).toBe('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    const query = Object.fromEntries(url.searchParams);
    expect(query).toMatchObject({
      vnp_TmnCode: 'TESTCODE',
      vnp_Amount: '24900000',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: response.body.paymentId,
      vnp_ReturnUrl: 'http://localhost:5173/payments/vnpay/return'
    });
    expect(verifyVnpay(query, SECRET)).toBe(true);
  });
});

describe('VNPay IPN', () => {
  it('marks a payment paid once and answers 02 the second time', async () => {
    const { response } = await startPayment();
    const answer = vnpayAnswer(response.body.paymentId, 'pro-6m');

    const first = await api().get('/api/payments/vnpay/ipn').query(answer);
    expect(first.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(await PaymentModel.findById(response.body.paymentId)).toMatchObject({
      status: 'paid',
      vnpTransactionNo: '14000001'
    });

    expect((await api().get('/api/payments/vnpay/ipn').query(answer)).body.RspCode).toBe('02');
  });

  it('marks a payment failed when VNPay says the learner did not pay, and gives nothing', async () => {
    const { user, response } = await startPayment('coins-500');
    const answer = vnpayAnswer(response.body.paymentId, 'coins-500', { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' });

    expect((await api().get('/api/payments/vnpay/ipn').query(answer)).body.RspCode).toBe('00');
    expect(await PaymentModel.findById(response.body.paymentId)).toMatchObject({ status: 'failed' });
    expect((await reload(user._id))!.coins).toBe(0);
  });

  it('refuses a bad checksum, an unknown payment and a wrong amount, and gives nothing', async () => {
    const { user, response } = await startPayment('coins-500');
    const id = response.body.paymentId as string;

    const forged = { ...vnpayAnswer(id, 'coins-500'), vnp_SecureHash: 'f'.repeat(128) };
    expect((await api().get('/api/payments/vnpay/ipn').query(forged)).body.RspCode).toBe('97');
    expect((await api().get('/api/payments/vnpay/ipn').query(vnpayAnswer('0'.repeat(24), 'coins-500'))).body.RspCode).toBe('01');
    expect((await api().get('/api/payments/vnpay/ipn').query(vnpayAnswer(id, 'coins-500', { vnp_Amount: '100' }))).body.RspCode).toBe('04');
    expect(await PaymentModel.findById(id)).toMatchObject({ status: 'pending' });
    expect((await reload(user._id))!.coins).toBe(0);
  });
});

describe('what a paid payment gives', () => {
  it('adds the coins of a pack once, even when the return and the IPN arrive together', async () => {
    const { user, response } = await startPayment('coins-1400');
    const answer = vnpayAnswer(response.body.paymentId, 'coins-1400');

    await Promise.all([api().get('/api/payments/vnpay/ipn').query(answer), api().get('/api/payments/vnpay/return').query(answer)]);
    await api().get('/api/payments/vnpay/ipn').query(answer);

    expect((await reload(user._id))!.coins).toBe(1400);
  });

  it('starts Pro now for a learner who never had it', async () => {
    const { user, response } = await startPayment('pro-1m');
    const before = Date.now();

    await api().get('/api/payments/vnpay/ipn').query(vnpayAnswer(response.body.paymentId, 'pro-1m'));

    const until = (await reload(user._id))!.proUntil!.getTime();
    expect(until).toBeGreaterThanOrEqual(before + 30 * DAY);
    expect(until).toBeLessThan(Date.now() + 30 * DAY + 1000);
  });

  it('adds time after the end of a Pro that is still active', async () => {
    const user = await createUser({});
    const end = new Date(Date.now() + 10 * DAY);
    await UserModel.updateOne({ _id: user._id }, { proUntil: end });
    const { response } = await startPayment('pro-6m', user);

    await api().get('/api/payments/vnpay/ipn').query(vnpayAnswer(response.body.paymentId, 'pro-6m'));

    expect((await reload(user._id))!.proUntil!.getTime()).toBe(end.getTime() + 180 * DAY);
  });

  it('starts from now when the Pro already ended', async () => {
    const user = await createUser({});
    await UserModel.updateOne({ _id: user._id }, { proUntil: new Date(Date.now() - 40 * DAY) });
    const { response } = await startPayment('pro-12m', user);
    const before = Date.now();

    await api().get('/api/payments/vnpay/ipn').query(vnpayAnswer(response.body.paymentId, 'pro-12m'));

    expect((await reload(user._id))!.proUntil!.getTime()).toBeGreaterThanOrEqual(before + 365 * DAY);
  });

  it('repairs a give that failed: the next call gives it', async () => {
    const { user, response } = await startPayment('coins-500');
    const answer = vnpayAnswer(response.body.paymentId, 'coins-500');
    vi.spyOn(UserModel, 'updateOne').mockRejectedValueOnce(new Error('db down'));

    expect((await api().get('/api/payments/vnpay/ipn').query(answer)).status).toBe(500);
    expect((await reload(user._id))!.coins).toBe(0);
    expect((await PaymentModel.findById(response.body.paymentId))!.grantedAt).toBeNull();

    await api().get('/api/payments/vnpay/ipn').query(answer);
    expect((await reload(user._id))!.coins).toBe(500);
  });

  it('shows Pro on the account, and a body cannot set it', async () => {
    const { user, response } = await startPayment('pro-1m');
    const auth = bearerFor(user);
    expect((await api().get('/api/auth/me').set('Authorization', auth)).body.pro).toEqual({ active: false, until: null });

    await api().get('/api/payments/vnpay/ipn').query(vnpayAnswer(response.body.paymentId, 'pro-1m'));

    const me = (await api().get('/api/auth/me').set('Authorization', auth)).body;
    expect(me.pro.active).toBe(true);
    expect(me).not.toHaveProperty('proUntil');

    await api().patch('/api/profile').set('Authorization', auth).send({ proUntil: '2099-01-01', coins: 99999 });
    expect((await reload(user._id))!.coins).toBe(0);
    expect((await reload(user._id))!.proUntil!.getFullYear()).toBeLessThan(2099);
  });
});

describe('Pro avatar items', () => {
  // The Neon sprites are not in the item list yet: stand in with an existing optional-slot item.
  const slotItem = 'headwear:crown';
  const pro = (until: Date | null) => ({ proUntil: until });
  const withProItem = () => {
    PRO_ITEMS.push(slotItem);
    return () => void PRO_ITEMS.splice(PRO_ITEMS.indexOf(slotItem), 1);
  };
  const catalogItem = async (auth: string) =>
    (await api().get('/api/avatar/catalog').set('Authorization', auth)).body.slots.headwear.find((item: { id: string }) => item.id === 'crown');

  it('is owned only while Pro is active, and the catalog says so', async () => {
    const undo = withProItem();
    try {
      const user = await createUser({});
      const auth = bearerFor(user);
      expect(await catalogItem(auth)).toMatchObject({ unlock: { kind: 'pro' }, owned: false });

      await UserModel.updateOne({ _id: user._id }, pro(new Date(Date.now() + DAY)));
      expect(await catalogItem(auth)).toMatchObject({ owned: true });
      const body = (await api().get('/api/avatar/catalog').set('Authorization', auth)).body;
      expect(body.pro.active).toBe(true);
    } finally {
      undo();
    }
  });

  it('cannot be saved without Pro, can with it, and comes off when Pro ends', async () => {
    const undo = withProItem();
    try {
      const user = await createUser({});
      const auth = bearerFor(user);
      const look = { skin: 'peach', face: 'classic', hair: 'short-brown', top: 'red', bottom: 'navy', shoes: 'sneakers-brown', headwear: 'crown', accessory: null, back: null, effect: null };

      expect((await api().put('/api/avatar').set('Authorization', auth).send(look)).status).toBe(400);

      await UserModel.updateOne({ _id: user._id }, pro(new Date(Date.now() + DAY)));
      expect((await api().put('/api/avatar').set('Authorization', auth).send(look)).status).toBe(200);

      await UserModel.updateOne({ _id: user._id }, pro(new Date(Date.now() - 1000)));
      const me = (await api().get('/api/auth/me').set('Authorization', auth)).body;
      expect(me.avatar.headwear).toBeNull();
      expect(me.pro.active).toBe(false);
    } finally {
      undo();
    }
  });

  it('is never for sale with coins', async () => {
    const undo = withProItem();
    try {
      const user = await createUser({});
      await UserModel.updateOne({ _id: user._id }, { coins: 9999 });
      const response = await api().post('/api/avatar/buy').set('Authorization', bearerFor(user)).send({ item: slotItem });
      expect(response.status).toBe(400);
    } finally {
      undo();
    }
  });
});

describe('GET /api/payments/vnpay/return', () => {
  it('confirms the payment and tells the page its status and what it gave', async () => {
    const { response } = await startPayment('coins-500');

    const result = await api().get('/api/payments/vnpay/return').query(vnpayAnswer(response.body.paymentId, 'coins-500'));

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      status: 'paid',
      amount: 20_000,
      orderInfo: PAYMENT_PRODUCTS['coins-500'].orderInfo,
      product: 'coins-500',
      grant: { kind: 'coins', coins: 500 }
    });
  });

  it('answers 400 to a forged return', async () => {
    const { response } = await startPayment('coins-500');
    const forged = { ...vnpayAnswer(response.body.paymentId, 'coins-500'), vnp_SecureHash: 'f'.repeat(128) };

    expect((await api().get('/api/payments/vnpay/return').query(forged)).status).toBe(400);
    expect(await PaymentModel.findById(response.body.paymentId)).toMatchObject({ status: 'pending' });
  });
});

// ---- MoMo, next to VNPay ----

const MOMO = { accessKey: 'test-momo-access', secret: 'test-momo-secret' };

const startMomo = async (product: PaymentProduct = 'coins-500', momoReply: object = { resultCode: 0, payUrl: 'https://test-payment.momo.vn/pay/abc' }) => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(momoReply));
  const owner = await createUser({});
  const response = await api().post('/api/payments/momo').set('Authorization', bearerFor(owner)).send({ product });
  return { user: owner, response, fetchSpy };
};

/** What MoMo sends back (return URL: text, IPN: JSON with numbers), signed like MoMo does. */
const momoAnswer = (orderId: string, product: PaymentProduct, overrides: Record<string, string> = {}) => {
  const params: Record<string, string> = {
    partnerCode: 'MOMOTEST', orderId, requestId: orderId, amount: String(PAYMENT_PRODUCTS[product].amount),
    orderInfo: PAYMENT_PRODUCTS[product].orderInfo, orderType: 'momo_wallet', transId: '4100000001', resultCode: '0',
    message: 'Successful.', payType: 'qr', responseTime: '1700000000000', extraData: '', ...overrides
  };
  return { ...params, signature: signMomoResult(params, MOMO.accessKey, MOMO.secret) };
};

describe('POST /api/payments/momo', () => {
  it('needs a signed-in user and rejects an unknown product', async () => {
    expect((await api().post('/api/payments/momo').send({ product: 'pro-6m' })).status).toBe(401);
    const auth = bearerFor(await createUser({}));
    expect((await api().post('/api/payments/momo').set('Authorization', auth).send({ product: 'free' })).status).toBe(400);
  });

  it('saves a pending MoMo payment, asks MoMo with a signed request and returns the payUrl', async () => {
    const { user, response, fetchSpy } = await startMomo('pro-6m');

    expect(response.status).toBe(201);
    expect(response.body.paymentUrl).toBe('https://test-payment.momo.vn/pay/abc');
    const payment = await PaymentModel.findById(response.body.paymentId);
    expect(payment).toMatchObject({ product: 'pro-6m', amount: 249_000, status: 'pending', provider: 'momo' });
    expect(String(payment!.owner)).toBe(String(user._id));

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://test-payment.momo.vn/v2/gateway/api/create');
    const sent = JSON.parse(String(init?.body));
    expect(sent).toMatchObject({
      partnerCode: 'MOMOTEST', orderId: response.body.paymentId, amount: 249_000, requestType: 'captureWallet',
      redirectUrl: 'http://localhost:5173/payments/momo/return'
    });
    expect(sent.accessKey).toBeUndefined();
    expect(sent.signature).toBe(signMomoCreate({ ...sent, amount: String(sent.amount), accessKey: MOMO.accessKey }, MOMO.secret));
  });

  it('answers 502 and closes the try when MoMo refuses', async () => {
    const { response } = await startMomo('coins-500', { resultCode: 11, message: 'denied' });

    expect(response.status).toBe(502);
    expect(await PaymentModel.findOne({ provider: 'momo' })).toMatchObject({ status: 'failed', momoResultCode: '11' });
  });

  it('with the development mock, pays without calling MoMo: the return page confirms it and the coins are given', async () => {
    env.momoMock = true;
    try {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const user = await createUser({});
      const response = await api().post('/api/payments/momo').set('Authorization', bearerFor(user)).send({ product: 'coins-1400' });

      expect(response.status).toBe(201);
      expect(fetchSpy).not.toHaveBeenCalled();
      const url = new URL(response.body.paymentUrl);
      expect(url.origin + url.pathname).toBe('http://localhost:5173/payments/momo/return');

      const back = await api().get('/api/payments/momo/return').query(Object.fromEntries(url.searchParams));
      expect(back.body).toMatchObject({ status: 'paid', product: 'coins-1400' });
      expect((await reload(user._id))!.coins).toBe(1400);
    } finally {
      env.momoMock = false;
    }
  });

  it('gives up on a MoMo that does not answer (the request has a time limit) and closes the try', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
    const response = await api().post('/api/payments/momo').set('Authorization', bearerFor(await createUser({}))).send({ product: 'coins-500' });

    expect(response.status).toBe(502);
    expect(fetchSpy.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(await PaymentModel.findOne({ provider: 'momo' })).toMatchObject({ status: 'failed' });
  });
});

describe('POST /api/payments/momo/ipn and GET /momo/return', () => {
  it('gives the coins once when the IPN (JSON, numbers) and the return arrive, and answers 204', async () => {
    const { user, response } = await startMomo('coins-1400');
    const answer = momoAnswer(response.body.paymentId, 'coins-1400');
    const asJson = { ...answer, amount: Number(answer.amount), resultCode: 0, transId: Number(answer.transId), responseTime: Number(answer.responseTime) };

    const ipn = await api().post('/api/payments/momo/ipn').send(asJson);
    expect(ipn.status).toBe(204);
    const back = await api().get('/api/payments/momo/return').query(answer);
    expect(back.body).toMatchObject({ status: 'paid', amount: 50_000, product: 'coins-1400', grant: { kind: 'coins', coins: 1400 } });
    await api().post('/api/payments/momo/ipn').send(asJson);

    expect(await PaymentModel.findById(response.body.paymentId)).toMatchObject({ status: 'paid', momoTransId: '4100000001', momoResultCode: '0' });
    expect((await reload(user._id))!.coins).toBe(1400);
  });

  it('adds Pro days for a Pro plan', async () => {
    const { user, response } = await startMomo('pro-1m');

    await api().post('/api/payments/momo/ipn').send(momoAnswer(response.body.paymentId, 'pro-1m'));

    const proUntil = (await reload(user._id))!.proUntil!.getTime();
    expect(proUntil).toBeGreaterThan(Date.now() + 29 * DAY);
  });

  it('marks a payment failed when the learner did not pay, and gives nothing', async () => {
    const { user, response } = await startMomo('coins-500');

    const result = await api().get('/api/payments/momo/return').query(momoAnswer(response.body.paymentId, 'coins-500', { resultCode: '1006' }));

    expect(result.body.status).toBe('failed');
    expect((await reload(user._id))!.coins).toBe(0);
  });

  it('refuses a bad signature, an unknown payment, a wrong amount and a VNPay payment, and gives nothing', async () => {
    const { user, response } = await startMomo('coins-500');
    const id = response.body.paymentId as string;

    expect((await api().post('/api/payments/momo/ipn').send({ ...momoAnswer(id, 'coins-500'), signature: 'f'.repeat(64) })).status).toBe(400);
    expect((await api().post('/api/payments/momo/ipn').send(momoAnswer('0'.repeat(24), 'coins-500'))).status).toBe(404);
    expect((await api().post('/api/payments/momo/ipn').send(momoAnswer(id, 'coins-500', { amount: '100' }))).status).toBe(400);
    const vnpay = await startPayment('coins-500', user);
    expect((await api().post('/api/payments/momo/ipn').send(momoAnswer(vnpay.response.body.paymentId, 'coins-500'))).status).toBe(404);
    expect((await api().post('/api/payments/momo/ipn').send({ orderId: id })).status).toBe(400);

    expect(await PaymentModel.findById(id)).toMatchObject({ status: 'pending' });
    expect((await reload(user._id))!.coins).toBe(0);
  });
});
