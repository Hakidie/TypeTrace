import { env } from '../config/env';
import { PAYMENT_PRODUCTS, PaymentProduct, productAmount } from '../config/payment';
import { PaymentDocument, PaymentModel } from '../models/payment.model';
import { UserModel } from '../models/user.model';
import { AppError, badRequest } from '../utils/app-error';
import { MomoParams, signMomoCreate, signMomoResult, verifyMomo } from '../utils/momo';
import { newPayosOrderCode, PayosFields, signPayosCreate, verifyPayos } from '../utils/payos';
import { buildVnpayUrl, verifyVnpay, vnpayDate, VnpParams } from '../utils/vnpay';
import { objectIdSchema } from '../validators/common.validator';
import { getPlanConfig } from './app-setting.service';
import { recordPaidMonth } from './subscription.service';

const PAYMENT_EXPIRES_MS = 15 * 60 * 1000;
const MOMO_TIMEOUT_MS = 15_000;
const PAYOS_TIMEOUT_MS = 15_000;

/** What a product costs now: Premium follows the price of one month an admin set in the Plans page. */
const priceOf = async (product: PaymentProduct) => {
  const amount = productAmount(product, (await getPlanConfig('premium')).priceVnd);
  if (amount < 1) throw badRequest('This product is not for sale');
  return amount;
};

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

const payosConfig = () => {
  if (!env.payosClientId || !env.payosApiKey || !env.payosChecksumKey) throw new AppError(503, 'payOS is not configured');
  return { clientId: env.payosClientId, apiKey: env.payosApiKey, checksumKey: env.payosChecksumKey };
};

/** What payOS answers: `code` '00' is success, `data` is the payment link or the webhook's payment. */
interface PayosAnswer {
  code?: string;
  data?: { checkoutUrl?: string; paymentLinkId?: string; status?: string; amount?: number };
}

const payosRequest = async (path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<PayosAnswer | null> => {
  const { clientId, apiKey } = payosConfig();
  const response = await fetch(`${env.payosUrl}${path}`, {
    method: init.method,
    headers: { 'Content-Type': 'application/json', 'x-client-id': clientId, 'x-api-key': apiKey },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(PAYOS_TIMEOUT_MS)
  }).catch(() => null);
  return ((await response?.json().catch(() => null)) as PayosAnswer | null) ?? null;
};

/** Saves a pending payment and returns the VNPay page the learner pays on. */
export const createVnpayPayment = async (ownerId: string, product: PaymentProduct, ip: string) => {
  const { tmnCode, secret } = vnpayConfig();
  const { orderInfo } = PAYMENT_PRODUCTS[product];
  const amount = await priceOf(product);
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
  const { orderInfo } = PAYMENT_PRODUCTS[product];
  const amount = await priceOf(product);
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

/** Saves a pending payment and asks payOS for the page the learner pays on (`checkoutUrl`). */
export const createPayosPayment = async (ownerId: string, product: PaymentProduct) => {
  const { checksumKey } = payosConfig();
  const { orderInfo } = PAYMENT_PRODUCTS[product];
  const amount = await priceOf(product);
  const orderCode = newPayosOrderCode();
  const payment = await PaymentModel.create({ owner: ownerId, product, amount, orderInfo, provider: 'payos', payosOrderCode: orderCode });

  // payOS keeps the description to 25 characters.
  const fields = {
    orderCode,
    amount,
    description: `TypeTrace ${product}`,
    returnUrl: `${env.clientUrl}/payments/payos/return`,
    cancelUrl: `${env.clientUrl}/payments/payos/return`
  };
  const answer = await payosRequest('/v2/payment-requests', {
    method: 'POST',
    body: { ...fields, expiredAt: Math.floor((Date.now() + PAYMENT_EXPIRES_MS) / 1000), signature: signPayosCreate(fields, checksumKey) }
  });
  if (!answer || answer.code !== '00' || !answer.data?.checkoutUrl) {
    // The learner never reached payOS: the try is closed, not left pending.
    await PaymentModel.updateOne({ _id: payment._id }, { status: 'failed', payosStatus: answer?.code ?? '' });
    throw new AppError(502, 'payOS could not start the payment');
  }
  await PaymentModel.updateOne({ _id: payment._id }, { payosLinkId: answer.data.paymentLinkId });
  return { paymentId: payment.id as string, paymentUrl: answer.data.checkoutUrl };
};

/** The catalog the store shows: ids, prices and what each one gives. */
export const listProducts = async () => {
  const { priceVnd } = await getPlanConfig('premium');
  return (Object.keys(PAYMENT_PRODUCTS) as PaymentProduct[])
    .map((id) => ({ id, amount: productAmount(id, priceVnd), grant: PAYMENT_PRODUCTS[id].grant }))
    .filter(({ amount }) => amount > 0);
};

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
  try {
    // Premium: a paid term in the learner's plan history (US11.1), after the Premium they already have.
    if (grant.kind === 'premium') await recordPaidMonth(String(payment.owner), grant.months);
    else await UserModel.updateOne({ _id: payment.owner }, { $inc: { coins: grant.coins } });
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

/**
 * payOS's webhook (server to server, signed with the checksum key). `data.code` '00' is a paid payment.
 * `not-found` is not an error for payOS: it tests the address with a made-up order when the webhook is registered.
 */
export const applyPayosWebhook = async (body: { success?: boolean; data?: PayosFields; signature?: string }): Promise<PaymentOutcome> => {
  const { checksumKey } = payosConfig();
  if (!body.data || !verifyPayos(body.data, body.signature, checksumKey)) return { result: 'invalid-signature' };

  const payment = await PaymentModel.findOne({ payosOrderCode: Number(body.data.orderCode), provider: 'payos' });
  if (!payment) return { result: 'not-found' };
  if (payment.amount !== Number(body.data.amount)) return { result: 'invalid-amount' };

  const paid = body.success === true && body.data.code === '00';
  return confirmPayment(payment, paid, { payosStatus: paid ? 'PAID' : String(body.data.code ?? ''), payosLinkId: String(body.data.paymentLinkId ?? '') });
};

/**
 * The learner's browser comes back from payOS. The query is not signed, so it proves nothing: the server asks payOS
 * (with its own keys) what became of the order, and only a PAID answer pays. A payment payOS still shows as open stays pending.
 */
export const applyPayosReturn = async (orderCode: number): Promise<PaymentOutcome> => {
  payosConfig();
  const payment = await PaymentModel.findOne({ payosOrderCode: orderCode, provider: 'payos' });
  if (!payment) return { result: 'not-found' };
  if (payment.status !== 'pending') return confirmPayment(payment, payment.status === 'paid', {});

  const answer = await payosRequest(`/v2/payment-requests/${orderCode}`, { method: 'GET' });
  const info = answer?.code === '00' ? answer.data : undefined;
  if (!info?.status) return { result: 'ok', payment };
  if (info.status === 'PAID') {
    if (info.amount !== payment.amount) return { result: 'invalid-amount' };
    return confirmPayment(payment, true, { payosStatus: info.status, payosLinkId: info.paymentLinkId });
  }
  if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(info.status)) return confirmPayment(payment, false, { payosStatus: info.status });
  return { result: 'ok', payment };
};
