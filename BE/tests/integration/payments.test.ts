import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../src/config/env';
import { PAYMENT_PRODUCTS, PaymentProduct, productAmount } from '../../src/config/payment';
import { PREMIUM_ITEMS } from '../../src/data/avatar-catalog';
import { DEFAULT_PLANS } from '../../src/models/app-setting.model';
import { SubscriptionModel } from '../../src/models/subscription.model';
import { updateAppSettings } from '../../src/services/app-setting.service';
import { getCurrentSubscription, grantPremium, revokePremium } from '../../src/services/subscription.service';
import { PaymentModel } from '../../src/models/payment.model';
import { UserModel } from '../../src/models/user.model';
import { signMomoCreate, signMomoResult } from '../../src/utils/momo';
import { signPayosCreate, signPayosData } from '../../src/utils/payos';
import { signVnpay, verifyVnpay } from '../../src/utils/vnpay';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const SECRET = 'test-vnpay-secret';
const DAY = 86_400_000;
/** What a product costs at the default price of Premium (99.000 ₫ a month; 6 months: 15% off). */
const amountOf = (product: PaymentProduct) => productAmount(product, DEFAULT_PLANS.premium.priceVnd);

const startPayment = async (product: PaymentProduct = 'premium-6m', user?: Awaited<ReturnType<typeof createUser>>) => {
  const owner = user ?? (await createUser({}));
  const response = await api().post('/api/payments/vnpay').set('Authorization', bearerFor(owner)).send({ product });
  return { user: owner, response };
};

/** What VNPay appends to the return URL and the IPN call, signed like VNPay does. */
const vnpayAnswer = (paymentId: string, product: PaymentProduct, overrides: Record<string, string> = {}) => {
  const params: Record<string, string> = {
    vnp_TxnRef: paymentId,
    vnp_Amount: String(amountOf(product) * 100),
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
    expect(response.body).toContainEqual({ id: 'premium-6m', amount: 505_000, grant: { kind: 'premium', months: 6 } });
    expect(response.body).toContainEqual({ id: 'coins-1400', amount: 50_000, grant: { kind: 'coins', coins: 1400 } });
  });

  it('prices Premium from the price of one month an admin sets in the Plans page, and stops selling it at 0', async () => {
    const auth = bearerFor(await createUser({}));
    await updateAppSettings({ plans: { ...DEFAULT_PLANS, premium: { ...DEFAULT_PLANS.premium, priceVnd: 50_000 } } });
    let body = (await api().get('/api/payments/products').set('Authorization', auth)).body;
    expect(body).toContainEqual({ id: 'premium-1m', amount: 50_000, grant: { kind: 'premium', months: 1 } });
    expect(body).toContainEqual({ id: 'premium-12m', amount: 456_000, grant: { kind: 'premium', months: 12 } });

    await updateAppSettings({ plans: { ...DEFAULT_PLANS, premium: { ...DEFAULT_PLANS.premium, priceVnd: 0 } } });
    body = (await api().get('/api/payments/products').set('Authorization', auth)).body;
    expect(body.map((product: { id: string }) => product.id)).not.toContain('premium-1m');
    expect((await api().post('/api/payments/vnpay').set('Authorization', auth).send({ product: 'premium-1m' })).status).toBe(400);
  });
});

describe('POST /api/payments/vnpay', () => {
  it('needs a signed-in user', async () => {
    expect((await api().post('/api/payments/vnpay').send({ product: 'premium-6m' })).status).toBe(401);
  });

  it('rejects an unknown product (the price is never taken from the client)', async () => {
    const auth = bearerFor(await createUser({}));
    const response = await api().post('/api/payments/vnpay').set('Authorization', auth).send({ product: 'free', amount: 1 });
    expect(response.status).toBe(400);
  });

  it('saves a pending payment and returns a signed VNPay url', async () => {
    const { user, response } = await startPayment('premium-6m');

    expect(response.status).toBe(201);
    const payment = await PaymentModel.findById(response.body.paymentId);
    expect(payment).toMatchObject({ product: 'premium-6m', amount: 505_000, status: 'pending' });
    expect(String(payment!.owner)).toBe(String(user._id));

    const url = new URL(response.body.paymentUrl);
    expect(url.origin + url.pathname).toBe('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    const query = Object.fromEntries(url.searchParams);
    expect(query).toMatchObject({
      vnp_TmnCode: 'TESTCODE',
      vnp_Amount: '50500000',
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
    const answer = vnpayAnswer(response.body.paymentId, 'premium-6m');

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

  it('starts Premium now for a learner on Free, as a paid term of their plan (US11.1), once', async () => {
    const { user, response } = await startPayment('premium-1m');
    const answer = vnpayAnswer(response.body.paymentId, 'premium-1m');

    await Promise.all([api().get('/api/payments/vnpay/ipn').query(answer), api().get('/api/payments/vnpay/return').query(answer)]);

    const plan = await getCurrentSubscription(String(user._id));
    expect(plan.plan).toBe('premium');
    expect(plan.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 27 * DAY);
    const terms = await SubscriptionModel.find({ user: user._id, plan: 'premium' });
    expect(terms).toHaveLength(1);
    expect(terms[0].source).toBe('payment');
  });

  it('adds the months after the end of a Premium that is still running', async () => {
    const user = await createUser({});
    const granted = await grantPremium(String(user._id), 1, String(user._id));
    const { response } = await startPayment('premium-6m', user);

    await api().get('/api/payments/vnpay/ipn').query(vnpayAnswer(response.body.paymentId, 'premium-6m'));

    const terms = await SubscriptionModel.find({ user: user._id, plan: 'premium' }).sort({ startsAt: 1 });
    expect(terms).toHaveLength(2);
    expect(terms[1].startsAt.getTime()).toBe(granted.expiresAt.getTime());
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

  it('shows Premium on the account, and a body cannot give it', async () => {
    const { user, response } = await startPayment('premium-1m');
    const auth = bearerFor(user);
    expect((await api().get('/api/auth/me').set('Authorization', auth)).body.premium).toEqual({ active: false, until: null });

    await api().patch('/api/profile').set('Authorization', auth).send({ premium: true, coins: 99999 });
    expect((await reload(user._id))!.coins).toBe(0);
    expect((await getCurrentSubscription(String(user._id))).plan).toBe('free');

    await api().get('/api/payments/vnpay/ipn').query(vnpayAnswer(response.body.paymentId, 'premium-1m'));

    const me = (await api().get('/api/auth/me').set('Authorization', auth)).body;
    expect(me.premium.active).toBe(true);
    expect(typeof me.premium.until).toBe('string');
  });
});

describe('Premium avatar items', () => {
  // Stand in with an existing optional-slot item, so the test does not depend on the Dragon sprites.
  const slotItem = 'headwear:crown';
  const withPremiumItem = () => {
    PREMIUM_ITEMS.push(slotItem);
    return () => void PREMIUM_ITEMS.splice(PREMIUM_ITEMS.indexOf(slotItem), 1);
  };
  const catalogItem = async (auth: string) =>
    (await api().get('/api/avatar/catalog').set('Authorization', auth)).body.slots.headwear.find((item: { id: string }) => item.id === 'crown');

  it('is owned only while on Premium, and the catalog says so', async () => {
    const undo = withPremiumItem();
    try {
      const user = await createUser({});
      const auth = bearerFor(user);
      expect(await catalogItem(auth)).toMatchObject({ unlock: { kind: 'premium' }, owned: false });

      await grantPremium(String(user._id), 1, String(user._id));
      expect(await catalogItem(auth)).toMatchObject({ owned: true });
      const body = (await api().get('/api/avatar/catalog').set('Authorization', auth)).body;
      expect(body.premium.active).toBe(true);
    } finally {
      undo();
    }
  });

  it('cannot be saved without Premium, can with it, and comes off when Premium ends', async () => {
    const undo = withPremiumItem();
    try {
      const user = await createUser({});
      const auth = bearerFor(user);
      const look = { skin: 'peach', face: 'classic', hair: 'short-brown', top: 'red', bottom: 'navy', shoes: 'sneakers-brown', headwear: 'crown', accessory: null, back: null, effect: null };

      expect((await api().put('/api/avatar').set('Authorization', auth).send(look)).status).toBe(400);

      await grantPremium(String(user._id), 1, String(user._id));
      expect((await api().put('/api/avatar').set('Authorization', auth).send(look)).status).toBe(200);

      await revokePremium(String(user._id), String(user._id));
      const me = (await api().get('/api/auth/me').set('Authorization', auth)).body;
      expect(me.avatar.headwear).toBeNull();
      expect(me.premium.active).toBe(false);
    } finally {
      undo();
    }
  });

  it('is never for sale with coins', async () => {
    const undo = withPremiumItem();
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
    partnerCode: 'MOMOTEST', orderId, requestId: orderId, amount: String(amountOf(product)),
    orderInfo: PAYMENT_PRODUCTS[product].orderInfo, orderType: 'momo_wallet', transId: '4100000001', resultCode: '0',
    message: 'Successful.', payType: 'qr', responseTime: '1700000000000', extraData: '', ...overrides
  };
  return { ...params, signature: signMomoResult(params, MOMO.accessKey, MOMO.secret) };
};

describe('POST /api/payments/momo', () => {
  it('needs a signed-in user and rejects an unknown product', async () => {
    expect((await api().post('/api/payments/momo').send({ product: 'premium-6m' })).status).toBe(401);
    const auth = bearerFor(await createUser({}));
    expect((await api().post('/api/payments/momo').set('Authorization', auth).send({ product: 'free' })).status).toBe(400);
  });

  it('saves a pending MoMo payment, asks MoMo with a signed request and returns the payUrl', async () => {
    const { user, response, fetchSpy } = await startMomo('premium-6m');

    expect(response.status).toBe(201);
    expect(response.body.paymentUrl).toBe('https://test-payment.momo.vn/pay/abc');
    const payment = await PaymentModel.findById(response.body.paymentId);
    expect(payment).toMatchObject({ product: 'premium-6m', amount: 505_000, status: 'pending', provider: 'momo' });
    expect(String(payment!.owner)).toBe(String(user._id));

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://test-payment.momo.vn/v2/gateway/api/create');
    const sent = JSON.parse(String(init?.body));
    expect(sent).toMatchObject({
      partnerCode: 'MOMOTEST', orderId: response.body.paymentId, amount: 505_000, requestType: 'captureWallet',
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

  it('starts Premium for a Premium plan', async () => {
    const { user, response } = await startMomo('premium-1m');

    await api().post('/api/payments/momo/ipn').send(momoAnswer(response.body.paymentId, 'premium-1m'));

    const plan = await getCurrentSubscription(String(user._id));
    expect(plan.plan).toBe('premium');
    expect(plan.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 27 * DAY);
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

// ---- payOS, next to VNPay and MoMo ----

const PAYOS_CHECKSUM = 'test-payos-checksum';
const PAYOS_LINK = { code: '00', data: { checkoutUrl: 'https://pay.payos.vn/web/abc', paymentLinkId: 'link-1' } };

const startPayos = async (product: PaymentProduct = 'coins-500', reply: object = PAYOS_LINK, user?: Awaited<ReturnType<typeof createUser>>) => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(reply));
  const owner = user ?? (await createUser({}));
  const response = await api().post('/api/payments/payos').set('Authorization', bearerFor(owner)).send({ product });
  const payment = await PaymentModel.findOne({ provider: 'payos', owner: owner._id }).sort({ createdAt: -1 });
  return { user: owner, response, fetchSpy, payment };
};

/** A webhook body, signed like payOS signs it. */
const payosWebhookBody = (orderCode: number, product: PaymentProduct, overrides: Record<string, unknown> = {}) => {
  const data = { orderCode, amount: amountOf(product), description: 'x', paymentLinkId: 'link-1', code: '00', desc: 'success', reference: 'FT1', ...overrides };
  return { code: '00', desc: 'success', success: true, data, signature: signPayosData(data, PAYOS_CHECKSUM) };
};

describe('POST /api/payments/payos', () => {
  it('needs a signed-in user and a known product', async () => {
    expect((await api().post('/api/payments/payos').send({ product: 'premium-6m' })).status).toBe(401);
    const auth = bearerFor(await createUser({}));
    expect((await api().post('/api/payments/payos').set('Authorization', auth).send({ product: 'free' })).status).toBe(400);
  });

  it('saves a pending payment with a whole order code and sends the signed request to payOS', async () => {
    const { response, fetchSpy, payment } = await startPayos('premium-6m');

    expect(response.status).toBe(201);
    expect(response.body.paymentUrl).toBe('https://pay.payos.vn/web/abc');
    expect(payment).toMatchObject({ product: 'premium-6m', amount: 505_000, status: 'pending', provider: 'payos', payosLinkId: 'link-1' });
    expect(Number.isSafeInteger(payment!.payosOrderCode)).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://api-merchant.payos.vn/v2/payment-requests');
    expect((init!.headers as Record<string, string>)['x-api-key']).toBe('test-payos-key');
    const sent = JSON.parse(String(init!.body));
    expect(sent).toMatchObject({ orderCode: payment!.payosOrderCode, amount: 505_000, returnUrl: 'http://localhost:5173/payments/payos/return' });
    expect(sent.description.length).toBeLessThanOrEqual(25);
    expect(sent.signature).toBe(signPayosCreate(sent, PAYOS_CHECKSUM));
  });

  it('closes the try and answers 502 when payOS refuses', async () => {
    const { response, payment } = await startPayos('coins-500', { code: '231', desc: 'denied' });
    expect(response.status).toBe(502);
    expect(payment).toMatchObject({ status: 'failed' });
  });

  it('answers 503 without keys', async () => {
    const saved = env.payosApiKey;
    env.payosApiKey = undefined;
    try {
      const response = await api().post('/api/payments/payos').set('Authorization', bearerFor(await createUser({}))).send({ product: 'coins-500' });
      expect(response.status).toBe(503);
    } finally {
      env.payosApiKey = saved;
    }
  });
});

describe('POST /api/payments/payos/webhook', () => {
  it('pays once, however many times payOS calls it, and gives the coins', async () => {
    const { user, payment } = await startPayos('coins-1400');
    const body = payosWebhookBody(payment!.payosOrderCode!, 'coins-1400');

    expect((await api().post('/api/payments/payos/webhook').send(body)).status).toBe(200);
    expect((await api().post('/api/payments/payos/webhook').send(body)).status).toBe(200);

    expect(await PaymentModel.findById(payment!._id)).toMatchObject({ status: 'paid', payosStatus: 'PAID' });
    expect((await reload(user._id))!.coins).toBe(1400);
  });

  it('gives a Premium term', async () => {
    const { user, payment } = await startPayos('premium-1m');
    await api().post('/api/payments/payos/webhook').send(payosWebhookBody(payment!.payosOrderCode!, 'premium-1m'));
    expect((await getCurrentSubscription(String(user._id))).plan).toBe('premium');
  });

  it('refuses a bad signature, a changed amount and gives nothing; answers 200 to an order it does not know', async () => {
    const { user, payment } = await startPayos('coins-500');
    const code = payment!.payosOrderCode!;

    expect((await api().post('/api/payments/payos/webhook').send({ ...payosWebhookBody(code, 'coins-500'), signature: 'f'.repeat(64) })).status).toBe(400);
    expect((await api().post('/api/payments/payos/webhook').send({ success: true })).status).toBe(400);
    expect((await api().post('/api/payments/payos/webhook').send(payosWebhookBody(code, 'coins-500', { amount: 100 }))).status).toBe(400);
    expect((await api().post('/api/payments/payos/webhook').send(payosWebhookBody(123, 'coins-500'))).status).toBe(200);

    expect(await PaymentModel.findById(payment!._id)).toMatchObject({ status: 'pending' });
    expect((await reload(user._id))!.coins).toBe(0);
  });
});

describe('GET /api/payments/payos/return', () => {
  const answerWith = (status: string, amount: number) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: '00', data: { status, amount, paymentLinkId: 'link-1' } }));

  it('asks payOS and pays when payOS says PAID, whatever the query says', async () => {
    const { user, payment } = await startPayos('coins-500');
    answerWith('PAID', amountOf('coins-500'));

    const result = await api().get('/api/payments/payos/return').query({ orderCode: payment!.payosOrderCode, cancel: 'true', status: 'CANCELLED' });

    expect(result.body).toMatchObject({ status: 'paid', product: 'coins-500' });
    expect((await reload(user._id))!.coins).toBe(500);
  });

  it('fails a payment payOS shows as cancelled, and keeps one still open pending', async () => {
    const cancelled = await startPayos('coins-500');
    answerWith('CANCELLED', amountOf('coins-500'));
    expect((await api().get('/api/payments/payos/return').query({ orderCode: cancelled.payment!.payosOrderCode })).body.status).toBe('failed');
    expect((await reload(cancelled.user._id))!.coins).toBe(0);

    const open = await startPayos('coins-500', PAYOS_LINK, cancelled.user);
    answerWith('PENDING', amountOf('coins-500'));
    expect((await api().get('/api/payments/payos/return').query({ orderCode: open.payment!.payosOrderCode })).body.status).toBe('pending');
  });

  it('stays pending when payOS cannot be reached, and refuses a wrong amount or an unknown order', async () => {
    const { user, payment } = await startPayos('coins-500');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    expect((await api().get('/api/payments/payos/return').query({ orderCode: payment!.payosOrderCode })).body.status).toBe('pending');

    answerWith('PAID', 100);
    expect((await api().get('/api/payments/payos/return').query({ orderCode: payment!.payosOrderCode })).status).toBe(400);
    expect((await api().get('/api/payments/payos/return').query({ orderCode: 42 })).status).toBe(404);
    expect((await api().get('/api/payments/payos/return').query({ orderCode: 'x' })).status).toBe(400);
    expect((await reload(user._id))!.coins).toBe(0);
  });
});

describe('GET /api/payments/mine', () => {
  it('needs a signed-in user and lists only their own payments, newest first, without gateway codes', async () => {
    expect((await api().get('/api/payments/mine')).status).toBe(401);
    const an = await createUser({ email: 'an@example.com' });
    const binh = await createUser({ email: 'binh@example.com' });
    await PaymentModel.create({ owner: an._id, product: 'coins-500', amount: 20_000, orderInfo: 'x', provider: 'momo', status: 'paid', paidAt: new Date(), momoTransId: 'T1' });
    await PaymentModel.create({ owner: an._id, product: 'premium-1m', amount: 99_000, orderInfo: 'x', status: 'failed', vnpResponseCode: '24' });
    await PaymentModel.create({ owner: binh._id, product: 'coins-500', amount: 20_000, orderInfo: 'x' });

    const res = await api().get('/api/payments/mine').set('Authorization', bearerFor(an));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items[0]).toMatchObject({ product: 'premium-1m', provider: 'vnpay', status: 'failed' });
    expect(res.body.items[1]).toMatchObject({ product: 'coins-500', provider: 'momo', status: 'paid', amount: 20_000 });
    expect(JSON.stringify(res.body)).not.toMatch(/momoTransId|vnpResponseCode|owner|orderInfo/);
  });

  it('reads a try whose link is over as expired, and keeps a fresh one pending', async () => {
    const an = await createUser({ email: 'an@example.com' });
    const old = await PaymentModel.create({ owner: an._id, product: 'coins-500', amount: 20_000, orderInfo: 'x' });
    await PaymentModel.collection.updateOne({ _id: old._id }, { $set: { createdAt: new Date(Date.now() - 20 * 60 * 1000) } });
    await PaymentModel.create({ owner: an._id, product: 'coins-1400', amount: 50_000, orderInfo: 'x' });

    const res = await api().get('/api/payments/mine').set('Authorization', bearerFor(an));

    expect(res.body.items.map((item: { status: string }) => item.status)).toEqual(['pending', 'expired']);
  });

  it('pages and refuses a sort on a private field', async () => {
    const an = await createUser({ email: 'an@example.com' });
    for (let i = 0; i < 3; i++) await PaymentModel.create({ owner: an._id, product: 'coins-500', amount: 20_000, orderInfo: 'x' });
    const auth = bearerFor(an);
    expect((await api().get('/api/payments/mine?limit=2').set('Authorization', auth)).body).toMatchObject({ total: 3, totalPages: 2 });
    expect((await api().get('/api/payments/mine?sort=owner').set('Authorization', auth)).status).toBe(400);
  });
});
