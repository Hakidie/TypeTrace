import { describe, expect, it } from 'vitest';
import { PAYMENT_PRODUCTS } from '../../src/config/payment';
import { PaymentModel } from '../../src/models/payment.model';
import { signVnpay, verifyVnpay } from '../../src/utils/vnpay';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const SECRET = 'test-vnpay-secret';

const startPayment = async () => {
  const user = await createUser({});
  const response = await api().post('/api/payments/vnpay').set('Authorization', bearerFor(user)).send({ product: 'pro' });
  return { user, response };
};

/** What VNPay appends to the return URL and the IPN call, signed like VNPay does. */
const vnpayAnswer = (paymentId: string, overrides: Record<string, string> = {}) => {
  const params: Record<string, string> = {
    vnp_TxnRef: paymentId,
    vnp_Amount: String(PAYMENT_PRODUCTS.pro.amount * 100),
    vnp_ResponseCode: '00',
    vnp_TransactionStatus: '00',
    vnp_TransactionNo: '14000001',
    ...overrides
  };
  return { ...params, vnp_SecureHash: signVnpay(params, SECRET) };
};

describe('POST /api/payments/vnpay', () => {
  it('needs a signed-in user', async () => {
    expect((await api().post('/api/payments/vnpay').send({ product: 'pro' })).status).toBe(401);
  });

  it('rejects an unknown product (the price is never taken from the client)', async () => {
    const auth = bearerFor(await createUser({}));
    const response = await api().post('/api/payments/vnpay').set('Authorization', auth).send({ product: 'free', amount: 1 });
    expect(response.status).toBe(400);
  });

  it('saves a pending payment and returns a signed VNPay url', async () => {
    const { user, response } = await startPayment();

    expect(response.status).toBe(201);
    const payment = await PaymentModel.findById(response.body.paymentId);
    expect(payment).toMatchObject({ product: 'pro', amount: 99_000, status: 'pending' });
    expect(String(payment!.owner)).toBe(String(user._id));

    const url = new URL(response.body.paymentUrl);
    expect(url.origin + url.pathname).toBe('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    const query = Object.fromEntries(url.searchParams);
    expect(query).toMatchObject({
      vnp_TmnCode: 'TESTCODE',
      vnp_Amount: '9900000',
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
    const answer = vnpayAnswer(response.body.paymentId);

    const first = await api().get('/api/payments/vnpay/ipn').query(answer);
    expect(first.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(await PaymentModel.findById(response.body.paymentId)).toMatchObject({
      status: 'paid',
      vnpTransactionNo: '14000001'
    });

    expect((await api().get('/api/payments/vnpay/ipn').query(answer)).body.RspCode).toBe('02');
  });

  it('marks a payment failed when VNPay says the learner did not pay', async () => {
    const { response } = await startPayment();
    const answer = vnpayAnswer(response.body.paymentId, { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' });

    expect((await api().get('/api/payments/vnpay/ipn').query(answer)).body.RspCode).toBe('00');
    expect(await PaymentModel.findById(response.body.paymentId)).toMatchObject({ status: 'failed' });
  });

  it('refuses a bad checksum, an unknown payment and a wrong amount', async () => {
    const { response } = await startPayment();
    const id = response.body.paymentId as string;

    const forged = { ...vnpayAnswer(id), vnp_SecureHash: 'f'.repeat(128) };
    expect((await api().get('/api/payments/vnpay/ipn').query(forged)).body.RspCode).toBe('97');
    expect((await api().get('/api/payments/vnpay/ipn').query(vnpayAnswer('0'.repeat(24)))).body.RspCode).toBe('01');
    expect((await api().get('/api/payments/vnpay/ipn').query(vnpayAnswer(id, { vnp_Amount: '100' }))).body.RspCode).toBe('04');
    expect(await PaymentModel.findById(id)).toMatchObject({ status: 'pending' });
  });
});

describe('GET /api/payments/vnpay/return', () => {
  it('confirms the payment and tells the page its status', async () => {
    const { response } = await startPayment();

    const result = await api().get('/api/payments/vnpay/return').query(vnpayAnswer(response.body.paymentId));

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: 'paid', amount: 99_000, orderInfo: PAYMENT_PRODUCTS.pro.orderInfo });
  });

  it('answers 400 to a forged return', async () => {
    const { response } = await startPayment();
    const forged = { ...vnpayAnswer(response.body.paymentId), vnp_SecureHash: 'f'.repeat(128) };

    expect((await api().get('/api/payments/vnpay/return').query(forged)).status).toBe(400);
    expect(await PaymentModel.findById(response.body.paymentId)).toMatchObject({ status: 'pending' });
  });
});
