import { CreditCard, ShoppingBag } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminPaymentsPage } from './pages/AdminPaymentsPage';
import { MomoReturnPage, PaymentReturnPage, PayosReturnPage } from './pages/PaymentReturnPage';
import { StorePage } from './pages/StorePage';

// The Store opens from the account menu. The return page is public: VNPay sends the browser there, and its checksum is the proof.
export const paymentsModule: AppModule = {
  routes: [{ path: '/store', Component: StorePage }],
  publicRoutes: [
    { path: '/payments/vnpay/return', Component: PaymentReturnPage },
    { path: '/payments/momo/return', Component: MomoReturnPage },
    { path: '/payments/payos/return', Component: PayosReturnPage },
  ],
  // Admins: every payment of every user, with a new check of an open payOS payment (`/api/admin/payments`).
  adminRoutes: [{ path: '/admin/payments', Component: AdminPaymentsPage }],
  adminNavItems: [{ to: '/admin/payments', label: 'Payments', icon: CreditCard }],
  menuItems: [{ label: 'Store', icon: ShoppingBag, to: '/store' }],
};
