import { DEFAULT_AVATAR, type AvatarLook } from '@/modules/avatar/types/avatar.types';
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

/** The look of the label of an option on a plan card (the admin Plans page and the plan dialog share it). */
export const STAT_LABEL_CLASS = 'text-2xl font-semibold leading-none tracking-wide text-primary/70';

export const PASSAGE_LIMIT_HELP =
  'The most passages a learner on this plan can keep. Older ones stay usable; the newest passages over the limit are locked, never deleted.';

/** The two permissions of a plan, with the words the cards use for them. */
export const PERMISSIONS = [
  {
    field: 'canCreateErrorPractice',
    label: 'Generate practice passage',
    help: 'Lets learners generate a practice passage made from the words they mistyped the most.',
  },
  {
    field: 'canUsePublicPassages',
    label: 'Allow premium passage',
    help: 'Lets learners practice the public passages that other learners wrote. Without it, they practice only the system passages and their own.',
  },
] as const;

export const PLAN_CARDS = [
  { key: 'free', name: 'Free' },
  { key: 'premium', name: 'Premium' },
] as const;

/** The pixel avatar that illustrates each plan on the plan dialog: what a new account wears for Free, the same avatar wearing the Dragon set Premium unlocks. Items of the avatar catalog (`FE/public/avatar`). */
export const PLAN_AVATARS: Record<'free' | 'premium', AvatarLook> = {
  free: DEFAULT_AVATAR,
  premium: { ...DEFAULT_AVATAR, headwear: 'dragon-horns', accessory: 'dragon-scarf', back: 'dragon-wings', effect: 'baby-dragon' },
};
