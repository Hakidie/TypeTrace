import mongoose, { Schema, Types } from 'mongoose';
import { PAYMENT_PRODUCT_IDS, PaymentProduct } from '../config/payment';

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_PROVIDERS = ['vnpay', 'momo', 'payos'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/** One try to pay through VNPay, MoMo or payOS. Its `_id` is the `vnp_TxnRef` sent to VNPay, or the `orderId` sent to MoMo; payOS gets `payosOrderCode`. */
export interface PaymentDocument extends mongoose.Document {
  owner: Types.ObjectId;
  product: PaymentProduct;
  /** Payments saved before MoMo have none: they are VNPay's. */
  provider?: PaymentProvider;
  /** In VND (VNPay gets it times 100, MoMo as it is). */
  amount: number;
  orderInfo: string;
  status: PaymentStatus;
  vnpTransactionNo?: string;
  vnpResponseCode?: string;
  momoTransId?: string;
  momoResultCode?: string;
  /** payOS wants a whole number as the order code, so it cannot be the `_id`. */
  payosOrderCode?: number;
  payosLinkId?: string;
  /** payOS's own word for the state (PAID, CANCELLED, EXPIRED, ...). */
  payosStatus?: string;
  paidAt?: Date;
  /** Set once, by the call that gave the learner what they bought (`grantPurchase`); empty while it is not given yet. */
  grantedAt?: Date | null;
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
    provider: { type: String, enum: PAYMENT_PROVIDERS },
    momoTransId: { type: String },
    momoResultCode: { type: String },
    payosOrderCode: { type: Number, unique: true, sparse: true },
    payosLinkId: { type: String },
    payosStatus: { type: String },
    paidAt: { type: Date },
    grantedAt: { type: Date, default: null }
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
