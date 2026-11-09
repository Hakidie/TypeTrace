import mongoose, { Schema, Types } from 'mongoose';
import { PAYMENT_PRODUCT_IDS, PaymentProduct } from '../config/payment';

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** One try to pay through VNPay. Its `_id` is the `vnp_TxnRef` sent to VNPay. */
export interface PaymentDocument extends mongoose.Document {
  owner: Types.ObjectId;
  product: PaymentProduct;
  /** In VND (VNPay gets it times 100). */
  amount: number;
  orderInfo: string;
  status: PaymentStatus;
  vnpTransactionNo?: string;
  vnpResponseCode?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentDocument>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: String, enum: PAYMENT_PRODUCT_IDS, required: true },
    amount: { type: Number, required: true, min: 1 },
    orderInfo: { type: String, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    vnpTransactionNo: { type: String },
    vnpResponseCode: { type: String },
    paidAt: { type: Date }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const PaymentModel = mongoose.model<PaymentDocument>('Payment', paymentSchema);
