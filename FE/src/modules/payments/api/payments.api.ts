import { http } from '@/shared/api/http';
import type { PaymentProduct, PaymentProvider, StartedPayment, VnpayReturn } from '../types/payments.types';

/** Every function resolves with the response body (not the Axios response). */
export const paymentsApi = {
  products: () => http.get<PaymentProduct[]>('/payments/products').then((r) => r.data),
  start: (product: string, provider: PaymentProvider = 'vnpay') =>
    http.post<StartedPayment>(`/payments/${provider}`, { product }).then((r) => r.data),
  /** `search` is the query string the gateway appended to the return URL; the server checks its checksum. */
  confirmReturn: (search: string, provider: PaymentProvider = 'vnpay') =>
    http.get<VnpayReturn>(`/payments/${provider}/return`, { params: Object.fromEntries(new URLSearchParams(search)) }).then((r) => r.data),
};
