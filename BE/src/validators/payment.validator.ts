import { z } from 'zod';
import { PAYMENT_PRODUCT_IDS } from '../config/payment';

export const createPaymentSchema = z.object({ product: z.enum(PAYMENT_PRODUCT_IDS) });

/** What VNPay appends to the return URL and the IPN call: only text fields, all kept for the checksum. */
export const vnpayQuerySchema = z
  .object({ vnp_TxnRef: z.string(), vnp_Amount: z.string(), vnp_SecureHash: z.string() })
  .catchall(z.string());

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
