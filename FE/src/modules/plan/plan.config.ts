import type { SubscriptionSource } from './types/plan.types';

/** What the SOURCE of a plan change reads in the admin list: how it was paid for. Only a payment has one (its method, VNPay, MoMo..., when US11.2 and US11.3 record it); every other change reads None, and who made it is in BY. */
export const SOURCE_LABELS: Record<SubscriptionSource, string> = {
  signup: 'None',
  payment: 'Payment',
  admin: 'None',
  auto: 'None',
  migration: 'None',
};

/** The time zone of the days the admin Plans page shows (the dates of the subscriptions, the users chart); the backend cuts the chart's days in the same one. */
export const PLAN_ZONE = 'Asia/Ho_Chi_Minh';

/** Which lines the users chart draws: both plans, only Premium or only Free. A click on a plan card picks its line; the Lines button of the chart picks any. */
export type PlanLines = 'all' | 'premium' | 'free';
export const LINES_OPTIONS: { value: PlanLines; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'premium', label: 'Premium' },
  { value: 'free', label: 'Free' },
];
