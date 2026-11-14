import { http } from '@/shared/api/http';
import type { ChartRange } from '@/modules/profile/types/profile.types';
import type { AdminPaymentListParams, AdminPaymentPage, AdminPaymentRow, MyPaymentPage, PaymentProduct, PaymentRevenueData, PaymentProvider, StartedPayment, VnpayReturn } from '../types/payments.types';

/** Every function resolves with the response body (not the Axios response). */
export const adminPaymentsApi = {
  list: (params: AdminPaymentListParams) => http.get<AdminPaymentPage>('/admin/payments', { params }).then((r) => r.data),
  /** The money of each gateway over a year, a month or a week (the one that holds `date`). */
  revenue: (range: ChartRange, date: string) => http.get<PaymentRevenueData>('/admin/payments/revenue', { params: { range, date } }).then((r) => r.data),
  /** Asks payOS again about an open payment, then gives what was bought. */
  recheck: (id: string) => http.post<AdminPaymentRow>(`/admin/payments/${id}/recheck`).then((r) => r.data),
};

export const paymentsApi = {
  products: () => http.get<PaymentProduct[]>('/payments/products').then((r) => r.data),
  /** One page of the signed-in learner's own payments, newest first. */
  mine: (page: number, limit: number) => http.get<MyPaymentPage>('/payments/mine', { params: { page, limit } }).then((r) => r.data),
  start: (product: string, provider: PaymentProvider = 'vnpay') =>
    http.post<StartedPayment>(`/payments/${provider}`, { product }).then((r) => r.data),
  /** `search` is the query string the gateway appended to the return URL; the server checks its checksum. */
  confirmReturn: (search: string, provider: PaymentProvider = 'vnpay') =>
    http.get<VnpayReturn>(`/payments/${provider}/return`, { params: Object.fromEntries(new URLSearchParams(search)) }).then((r) => r.data),
};
