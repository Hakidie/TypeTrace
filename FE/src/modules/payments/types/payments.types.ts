import type { ChartRange } from '@/modules/profile/types/profile.types';
import type { AvatarLook } from '@/modules/avatar/types/avatar.types';

/** What a paid product gives (mirrors `PaymentGrant` of `BE/src/config/payment.ts`). */
export type PaymentGrant = { kind: 'premium'; months: number } | { kind: 'coins'; coins: number };

/** One line of `GET /api/payments/products`: the prices and sizes come from the server, never from the frontend. */
export interface PaymentProduct {
  id: string;
  /** In VND. */
  amount: number;
  grant: PaymentGrant;
}

/** The three gateways: each has its own start and return routes under `/api/payments/<provider>`. */
export type PaymentProvider = 'vnpay' | 'momo' | 'payos';

/** `POST /api/payments/<provider>`: the gateway page the browser goes to. */
export interface StartedPayment {
  paymentId: string;
  paymentUrl: string;
}

/** `GET /api/payments/<provider>/return`: what the return page shows. */
export interface VnpayReturn {
  status: 'pending' | 'paid' | 'failed';
  amount: number;
  orderInfo: string;
  product: string;
  grant: PaymentGrant | null;
}

/** One row of `GET /api/admin/payments`. */
export interface AdminPaymentRow {
  _id: string;
  userName: string;
  email: string | null;
  /** The uploaded picture the buyer shows; `null` when they chose their pixel avatar or never set a picture. */
  avatarUrl: string | null;
  avatar: AvatarLook;
  product: string;
  /** In VND. */
  amount: number;
  provider: PaymentProvider;
  status: 'pending' | 'paid' | 'failed';
  /** The learner got what they bought. */
  granted: boolean;
  paidAt: string | null;
  createdAt: string;
}

export interface AdminPaymentPage {
  items: AdminPaymentRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminPaymentListParams {
  page: number;
  limit: number;
  sort: string;
  q?: string;
  status?: AdminPaymentRow['status'];
  provider?: PaymentProvider;
}

/** One row of `GET /api/payments/mine`: the learner's own history. `expired`: never paid and its link is over. */
export interface MyPaymentRow {
  _id: string;
  product: string;
  /** In VND. */
  amount: number;
  provider: PaymentProvider;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  paidAt: string | null;
  createdAt: string;
}

export interface MyPaymentPage {
  items: MyPaymentRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** The money each gateway took in a period (`GET /api/admin/payments/revenue`): only payments that are paid and given. `key` is 'YYYY-MM' (year), the first day of a block of 7 days (month) or a day (week), as in the Progress chart. In VND. */
export interface PaymentRevenuePoint {
  key: string;
  payos: number;
  vnpay: number;
  momo: number;
}

export interface PaymentRevenueData {
  range: ChartRange;
  points: PaymentRevenuePoint[];
}
