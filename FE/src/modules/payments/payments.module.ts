import { CreditCard, Receipt, ShoppingBag } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { PremiumRenewalBanner } from './components/PremiumRenewalBanner';
import { PaymentHistoryPage } from './pages/PaymentHistoryPage';
import { AdminPaymentsPage } from './pages/AdminPaymentsPage';
import { MomoReturnPage, PaymentReturnPage, PayosReturnPage } from './pages/PaymentReturnPage';
import { StorePage } from './pages/StorePage';

// The Store opens from the account menu. The return page is public: VNPay sends the browser there, and its checksum is the proof.
export const paymentsModule: AppModule = {
  routes: [
    { path: '/store', Component: StorePage },
    { path: '/store/history', Component: PaymentHistoryPage },
  ],
  // Premium that ends within 3 days asks whether to extend it, on every page of the app.
  widgets: [PremiumRenewalBanner],
  publicRoutes: [
    { path: '/payments/vnpay/return', Component: PaymentReturnPage },
    { path: '/payments/momo/return', Component: MomoReturnPage },
    { path: '/payments/payos/return', Component: PayosReturnPage },
  ],
  // Admins: every payment of every user, with a new check of an open payOS payment (`/api/admin/payments`).
  adminRoutes: [{ path: '/admin/payments', Component: AdminPaymentsPage }],
  adminNavItems: [{ to: '/admin/payments', label: 'Payments', icon: CreditCard }],
  menuItems: [
    { label: 'Store', icon: ShoppingBag, to: '/store' },
    { label: 'Payment', icon: Receipt, to: '/store/history' },
  ],
};
