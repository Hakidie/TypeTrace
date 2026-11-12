import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import { avatarKeys } from '@/modules/avatar/hooks/use-avatar';
import { paymentsApi } from '../api/payments.api';
import type { PaymentProvider } from '../types/payments.types';

export const paymentKeys = {
  products: ['payments', 'products'] as const,
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
      }
      return result;
    },
    // The answer for one return never changes, and a failed check (a forged link) is not worth asking again.
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
