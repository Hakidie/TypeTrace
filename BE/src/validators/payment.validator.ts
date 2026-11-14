import { z } from 'zod';
import { PAYMENT_PRODUCT_IDS } from '../config/payment';
import { PAYMENT_PROVIDERS, PAYMENT_STATUSES } from '../models/payment.model';
import { paginationQuerySchema, sortSchema } from '../utils/pagination';

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

/** What payOS appends to the return and cancel URL (`orderCode` and `id` are all the server needs; it asks payOS for the rest). */
export const payosReturnSchema = z.object({ orderCode: z.coerce.number().int().positive() });

/** payOS's webhook body: `data` is signed field by field, so every field is kept. */
export const payosWebhookSchema = z.object({
  success: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  signature: z.string().optional()
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/** `GET /api/admin/payments`: the payments of all users. */
export const listPaymentsQuerySchema = paginationQuerySchema.extend({
  /** Text searched in the buyer's display name and email. */
  q: z.string().trim().max(100).optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  provider: z.enum(PAYMENT_PROVIDERS).optional(),
  sort: sortSchema(['createdAt', 'amount'])
});

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
