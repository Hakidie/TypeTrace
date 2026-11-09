import type { SubscriptionSource } from './types/plan.types';

/** What the SOURCE of a plan change reads in the admin list: how it was paid for. Only a payment has one (its method, VNPay, MoMo..., when US11.2 and US11.3 record it); every other change reads None, and who made it is in BY. */
export const SOURCE_LABELS: Record<SubscriptionSource, string> = {
  signup: 'None',
  payment: 'Payment',
  admin: 'None',
  auto: 'None',
  migration: 'None',
};
