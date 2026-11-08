import { env } from '../config/env';
import { PAYMENT_PRODUCTS, PaymentProduct } from '../config/payment';
import { PaymentDocument, PaymentModel } from '../models/payment.model';
import { AppError } from '../utils/app-error';
import { buildVnpayUrl, verifyVnpay, vnpayDate, VnpParams } from '../utils/vnpay';
import { objectIdSchema } from '../validators/common.validator';

const PAYMENT_EXPIRES_MS = 15 * 60 * 1000;

const vnpayConfig = () => {
  if (!env.vnpTmnCode || !env.vnpHashSecret) throw new AppError(503, 'VNPay is not configured');
  return { tmnCode: env.vnpTmnCode, secret: env.vnpHashSecret };
};

/** Saves a pending payment and returns the VNPay page the learner pays on. */
export const createVnpayPayment = async (ownerId: string, product: PaymentProduct, ip: string) => {
  const { tmnCode, secret } = vnpayConfig();
  const { amount, orderInfo } = PAYMENT_PRODUCTS[product];
  const payment = await PaymentModel.create({ owner: ownerId, product, amount, orderInfo });

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

export type VnpayOutcome =
  | { result: 'ok' | 'already-confirmed'; payment: PaymentDocument }
  | { result: 'invalid-signature' | 'not-found' | 'invalid-amount' };

/**
 * Applies what VNPay says about a payment. The browser return and the IPN call both come here:
 * whichever arrives first changes the payment, the other one finds it already confirmed.
 */
export const applyVnpayResult = async (query: VnpParams): Promise<VnpayOutcome> => {
  const { secret } = vnpayConfig();
  if (!verifyVnpay(query, secret)) return { result: 'invalid-signature' };

  const payment = objectIdSchema.safeParse(query.vnp_TxnRef).success
    ? await PaymentModel.findById(query.vnp_TxnRef)
    : null;
  if (!payment) return { result: 'not-found' };
  if (String(payment.amount * 100) !== query.vnp_Amount) return { result: 'invalid-amount' };
  if (payment.status !== 'pending') return { result: 'already-confirmed', payment };

  const paid = query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';
  // Only a still-pending payment changes, so two calls at once cannot both win.
  const updated = await PaymentModel.findOneAndUpdate(
    { _id: payment._id, status: 'pending' },
    {
      status: paid ? 'paid' : 'failed',
      vnpTransactionNo: query.vnp_TransactionNo,
      vnpResponseCode: query.vnp_ResponseCode,
      ...(paid && { paidAt: new Date() })
    },
    { returnDocument: 'after' }
  );
  if (updated) return { result: 'ok', payment: updated };
  return { result: 'already-confirmed', payment: (await PaymentModel.findById(payment._id)) ?? payment };
};
