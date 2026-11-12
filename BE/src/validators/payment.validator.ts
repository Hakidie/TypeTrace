import { z } from 'zod';
import { PAYMENT_PRODUCT_IDS } from '../config/payment';

export const createPaymentSchema = z.object({ product: z.enum(PAYMENT_PRODUCT_IDS) });

/** What VNPay appends to the return URL and the IPN call: only text fields, all kept for the checksum. */
export const vnpayQuerySchema = z
  .object({ vnp_TxnRef: z.string(), vnp_Amount: z.string(), vnp_SecureHash: z.string() })
  .catchall(z.string());

/**
 * What MoMo sends back: the return URL has text fields, the IPN call a JSON body whose numbers (`amount`, `resultCode`,
 * `transId`) become text here, so one checksum code reads both. `orderId`, `amount` and `signature` must be there.
 */
export const momoResultSchema = z
  .record(z.string(), z.union([z.string(), z.number()]).transform(String))
  .refine((value) => Boolean(value.orderId && value.amount && value.signature), { message: 'orderId, amount and signature are required' });

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
