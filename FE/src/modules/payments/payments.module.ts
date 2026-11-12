import { ShoppingBag } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { MomoReturnPage, PaymentReturnPage } from './pages/PaymentReturnPage';
import { StorePage } from './pages/StorePage';

// The Store opens from the account menu. The return page is public: VNPay sends the browser there, and its checksum is the proof.
export const paymentsModule: AppModule = {
  routes: [{ path: '/store', Component: StorePage }],
  publicRoutes: [
    { path: '/payments/vnpay/return', Component: PaymentReturnPage },
    { path: '/payments/momo/return', Component: MomoReturnPage },
  ],
  menuItems: [{ label: 'Store', icon: ShoppingBag, to: '/store' }],
};
