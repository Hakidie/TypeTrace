import { env } from '../config/env';
import { PAYMENT_PRODUCTS, PaymentProduct } from '../config/payment';
import { PaymentDocument, PaymentModel } from '../models/payment.model';
import { UserModel } from '../models/user.model';
import { AppError } from '../utils/app-error';
import { MomoParams, signMomoCreate, signMomoResult, verifyMomo } from '../utils/momo';
import { buildVnpayUrl, verifyVnpay, vnpayDate, VnpParams } from '../utils/vnpay';
import { objectIdSchema } from '../validators/common.validator';

const PAYMENT_EXPIRES_MS = 15 * 60 * 1000;
const MOMO_TIMEOUT_MS = 15_000;

const vnpayConfig = () => {
  if (!env.vnpTmnCode || !env.vnpHashSecret) throw new AppError(503, 'VNPay is not configured');
  return { tmnCode: env.vnpTmnCode, secret: env.vnpHashSecret };
};

/** How long the mock MoMo "takes" to pay, so the button shows that it is opening (development only, `MOMO_MOCK`). */
export const MOMO_MOCK_DELAY_MS = 1500;

const momoConfig = () => {
  // The mock signs its own answer: development keys are enough when the real ones are not set.
  if (env.momoMock)
    return { partnerCode: env.momoPartnerCode ?? 'MOMOMOCK', accessKey: env.momoAccessKey ?? 'mock-access', secret: env.momoSecretKey ?? 'mock-secret' };
  if (!env.momoPartnerCode || !env.momoAccessKey || !env.momoSecretKey) throw new AppError(503, 'MoMo is not configured');
  return { partnerCode: env.momoPartnerCode, accessKey: env.momoAccessKey, secret: env.momoSecretKey };
};

/** Saves a pending payment and returns the VNPay page the learner pays on. */
export const createVnpayPayment = async (ownerId: string, product: PaymentProduct, ip: string) => {
  const { tmnCode, secret } = vnpayConfig();
  const { amount, orderInfo } = PAYMENT_PRODUCTS[product];
  const payment = await PaymentModel.create({ owner: ownerId, product, amount, orderInfo, provider: 'vnpay' });

  const now = new Date();
  const params: VnpParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: payment.id,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: `${env.clientUrl}/payments/vnpay/return`,
    vnp_IpAddr: ip,
    vnp_CreateDate: vnpayDate(now),
    vnp_ExpireDate: vnpayDate(new Date(now.getTime() + PAYMENT_EXPIRES_MS))
  };
  return { paymentId: payment.id as string, paymentUrl: buildVnpayUrl(env.vnpUrl, params, secret) };
};

/** Saves a pending payment and asks MoMo for the page the learner pays on (`payUrl`). */
export const createMomoPayment = async (ownerId: string, product: PaymentProduct) => {
  const { partnerCode, accessKey, secret } = momoConfig();
  const { amount, orderInfo } = PAYMENT_PRODUCTS[product];
  const payment = await PaymentModel.create({ owner: ownerId, product, amount, orderInfo, provider: 'momo' });

  const fields: MomoParams = {
    amount: String(amount),
    extraData: '',
    ipnUrl: env.momoIpnUrl,
    orderId: payment.id,
    orderInfo,
    partnerCode,
    redirectUrl: `${env.clientUrl}/payments/momo/return`,
    requestId: payment.id,
    requestType: 'captureWallet'
  };
  if (env.momoMock) {
    // Development: no call to MoMo. After a short wait, the browser goes straight to the return page with a paid answer
    // signed like MoMo's, so the return page, `applyMomoResult` and `grantPurchase` run exactly as for a real payment.
    await new Promise((resolve) => setTimeout(resolve, MOMO_MOCK_DELAY_MS));
    const answer: MomoParams = {
      partnerCode, orderId: payment.id, requestId: payment.id, amount: String(amount), orderInfo, orderType: 'momo_wallet',
      transId: `MOCK${Date.now()}`, resultCode: '0', message: 'Successful.', payType: 'mock', responseTime: String(Date.now()), extraData: ''
    };
    const query = new URLSearchParams({ ...answer, signature: signMomoResult(answer, accessKey, secret) });
    return { paymentId: payment.id as string, paymentUrl: `${env.clientUrl}/payments/momo/return?${query}` };
  }
  // `accessKey` is signed but never sent.
  const signature = signMomoCreate({ ...fields, accessKey }, secret);
  const response = await fetch(env.momoUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, amount, lang: 'vi', signature }),
    // MoMo's sandbox can hang for 30 s before answering 504: the learner gets an answer sooner.
    signal: AbortSignal.timeout(MOMO_TIMEOUT_MS)
  }).catch(() => null);
  const answer = (await response?.json().catch(() => null)) as { resultCode?: number; payUrl?: string } | null;
  if (!answer || answer.resultCode !== 0 || !answer.payUrl) {
    // The learner never reached MoMo: the try is closed, not left pending.
    await PaymentModel.updateOne({ _id: payment._id }, { status: 'failed', momoResultCode: String(answer?.resultCode ?? '') });
    throw new AppError(502, 'MoMo could not start the payment');
  }
  return { paymentId: payment.id as string, paymentUrl: answer.payUrl };
};

/** The catalog the store shows: ids, prices and what each one gives. */
export const listProducts = () =>
  Object.entries(PAYMENT_PRODUCTS).map(([id, { amount, grant }]) => ({ id, amount, grant }));

/**
 * Gives the learner what a paid payment bought, once. The call that sets `grantedAt` is the only one that goes on, so the
 * browser return and VNPay's IPN together cannot give it twice; if the give fails, `grantedAt` is cleared so the next call
 * (VNPay retries the IPN) tries again.
 */
const grantPurchase = async (payment: PaymentDocument) => {
  const product = PAYMENT_PRODUCTS[payment.product];
  if (!product) return;
  const claimed = await PaymentModel.findOneAndUpdate({ _id: payment._id, status: 'paid', grantedAt: null }, { grantedAt: new Date() });
  if (!claimed) return;
  const { grant } = product;
  const now = new Date();
  try {
    await UserModel.updateOne(
      { _id: payment.owner },
      grant.kind === 'coins'
        ? { $inc: { coins: grant.coins } }
        : // Pro time starts after the end of the current Pro, or now when there is none. One update, no read first.
          [{ $set: { proUntil: { $add: [{ $max: [{ $ifNull: ['$proUntil', now] }, now] }, grant.days * 86_400_000] } } }],
      { updatePipeline: true }
    );
  } catch (error) {
    await PaymentModel.updateOne({ _id: payment._id }, { grantedAt: null });
    throw error;
  }
};

export type PaymentOutcome =
  | { result: 'ok' | 'already-confirmed'; payment: PaymentDocument }
  | { result: 'invalid-signature' | 'not-found' | 'invalid-amount' };

/**
 * What a checked answer from a gateway does to a payment (VNPay and MoMo share it). Only a still-pending payment changes,
 * so two calls at once cannot both win; the other finds it already confirmed.
 */
const confirmPayment = async (payment: PaymentDocument, paid: boolean, gatewayFields: Partial<PaymentDocument>): Promise<PaymentOutcome> => {
  if (payment.status !== 'pending') {
    // A paid payment whose give failed before is repaired here.
    if (payment.status === 'paid') await grantPurchase(payment);
    return { result: 'already-confirmed', payment };
  }

  const updated = await PaymentModel.findOneAndUpdate(
    { _id: payment._id, status: 'pending' },
    { status: paid ? 'paid' : 'failed', ...gatewayFields, ...(paid && { paidAt: new Date() }) },
    { returnDocument: 'after' }
  );
  if (updated) {
    if (updated.status === 'paid') await grantPurchase(updated);
    return { result: 'ok', payment: updated };
  }
  return { result: 'already-confirmed', payment: (await PaymentModel.findById(payment._id)) ?? payment };
};

/**
 * Applies what VNPay says about a payment. The browser return and the IPN call both come here:
 * whichever arrives first changes the payment, the other one finds it already confirmed.
 */
export const applyVnpayResult = async (query: VnpParams): Promise<PaymentOutcome> => {
  const { secret } = vnpayConfig();
  if (!verifyVnpay(query, secret)) return { result: 'invalid-signature' };

  const payment = objectIdSchema.safeParse(query.vnp_TxnRef).success
    ? await PaymentModel.findById(query.vnp_TxnRef)
    : null;
  if (!payment) return { result: 'not-found' };
  if (String(payment.amount * 100) !== query.vnp_Amount) return { result: 'invalid-amount' };

  const paid = query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';
  return confirmPayment(payment, paid, { vnpTransactionNo: query.vnp_TransactionNo, vnpResponseCode: query.vnp_ResponseCode });
};

/** The same for MoMo: its return URL (query) and its IPN call (JSON body) both come here. `resultCode` 0 is a paid payment. */
export const applyMomoResult = async (answer: MomoParams): Promise<PaymentOutcome> => {
  const { accessKey, secret } = momoConfig();
  if (!verifyMomo(answer, accessKey, secret)) return { result: 'invalid-signature' };

  const payment = objectIdSchema.safeParse(answer.orderId).success
    ? await PaymentModel.findOne({ _id: answer.orderId, provider: 'momo' })
    : null;
  if (!payment) return { result: 'not-found' };
  if (String(payment.amount) !== answer.amount) return { result: 'invalid-amount' };

  return confirmPayment(payment, answer.resultCode === '0', { momoTransId: answer.transId, momoResultCode: answer.resultCode });
};
