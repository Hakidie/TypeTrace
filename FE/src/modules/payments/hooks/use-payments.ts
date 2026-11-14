import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import { avatarKeys } from '@/modules/avatar/hooks/use-avatar';
import { planKeys } from '@/modules/plan/hooks/use-plan';
import { toast } from 'sonner';
import { adminPaymentsApi, paymentsApi } from '../api/payments.api';
import type { AdminPaymentListParams, PaymentProvider } from '../types/payments.types';

export const paymentKeys = {
  products: ['payments', 'products'] as const,
  mine: (page: number, limit: number) => ['payments', 'mine', page, limit] as const,
  admin: (params: AdminPaymentListParams) => ['admin', 'payments', params] as const,
  vnpayReturn: (search: string) => ['payments', 'return', search] as const,
};

/** The prices and what each product gives. */
export const usePaymentProducts = () => useQuery({ queryKey: paymentKeys.products, queryFn: paymentsApi.products });

/**
 * Saves a pending payment and sends the browser to the gateway (VNPay or MoMo). No `onError`: the shared query client toasts
 * the backend message (for example when the gateway is not set up on the server).
 */
export const useStartPayment = () =>
  useMutation({
    mutationFn: ({ product, provider }: { product: string; provider: PaymentProvider }) => paymentsApi.start(product, provider),
    onSuccess: ({ paymentUrl }) => window.location.assign(paymentUrl),
  });

/**
 * The return page asks the server to confirm what the gateway sent back (the server also gets the gateway's own call,
 * whichever comes first changes the payment). The account, the coins and the catalog are read again, because the payment may have given something.
 */
export const useVnpayReturn = (search: string, provider: PaymentProvider = 'vnpay') => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: paymentKeys.vnpayReturn(`${provider}${search}`),
    queryFn: async () => {
      const result = await paymentsApi.confirmReturn(search, provider);
      if (result.status === 'paid') {
        void queryClient.invalidateQueries({ queryKey: currentUserKey });
        void queryClient.invalidateQueries({ queryKey: avatarKeys.catalog });
        // A Premium payment changes the plan (US11.1): its passage limit and permissions.
        void queryClient.invalidateQueries({ queryKey: planKeys.all });
      }
      return result;
    },
    // The answer for one return never changes, and a failed check (a forged link) is not worth asking again.
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
};

/** One page of the payments of all users; the previous page stays on screen while the next one loads. */
export const useAdminPayments = (params: AdminPaymentListParams) =>
  useQuery({ queryKey: paymentKeys.admin(params), queryFn: () => adminPaymentsApi.list(params), placeholderData: keepPreviousData });

/** Checks an open payOS payment again. No `onError`: the shared query client toasts the backend message. */
export const useRecheckPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminPaymentsApi.recheck,
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
      toast[row.status === 'paid' && row.granted ? 'success' : 'message'](
        row.status === 'paid' ? (row.granted ? 'Paid: the learner got what they bought.' : 'Paid, but not given yet.') : row.status === 'failed' ? 'payOS says this payment failed or was cancelled.' : 'payOS still shows this payment as open.',
      );
    },
  });
};

/** The learner's own payments, one page at a time; the previous page stays on screen while the next one loads. */
export const useMyPayments = (page: number, limit: number) =>
  useQuery({ queryKey: paymentKeys.mine(page, limit), queryFn: () => paymentsApi.mine(page, limit), placeholderData: keepPreviousData });
