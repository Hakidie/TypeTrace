import { DEFAULT_AVATAR, type AvatarLook } from '@/modules/avatar/types/avatar.types';
import { translatedRecord } from '@/shared/i18n/translated-record';
import type { SubscriptionSource } from './types/plan.types';

/** What the SOURCE of a plan change reads in the admin list: how it was paid for. Only a payment has one (its method, VNPay, MoMo..., when US11.2 and US11.3 record it); every other change reads None, and who made it is in BY. */
export const SOURCE_LABELS: Record<SubscriptionSource, string> = translatedRecord(
  ['signup', 'payment', 'admin', 'auto', 'migration'] as const,
  (source) => `store:adminPlans.sources.${source === 'payment' ? 'payment' : 'none'}`,
);

/** The time zone of the days the admin Plans page shows (the dates of the subscriptions, the users chart); the backend cuts the chart's days in the same one. */
export const PLAN_ZONE = 'Asia/Ho_Chi_Minh';

/** Which lines the users chart draws: both plans, only Premium or only Free. A click on a plan card picks its line; the Lines button of the chart picks any. */
export type PlanLines = 'all' | 'premium' | 'free';
/** The choices of the Lines button, in its order; their words are read when the chart is drawn (`common:toolbar.all`, the plan names). */
export const PLAN_LINES: PlanLines[] = ['all', 'premium', 'free'];

/** The look of the label of an option on a plan card (the admin Plans page and the plan dialog share it). */
export const STAT_LABEL_CLASS = 'text-2xl font-semibold leading-none tracking-wide text-primary/70';

/** The two permissions of a plan, with the keys (namespace `store`) of the words the admin cards use for them: a label and the help of its "?" (the plan dialog keeps its own words). */
export const PERMISSIONS = [
  { field: 'canCreateErrorPractice', labelKey: 'adminPlans.permission.errorPractice', helpKey: 'plan.trainHelp' },
  { field: 'canUsePublicPassages', labelKey: 'adminPlans.permission.publicPassages', helpKey: 'plan.publicHelp' },
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
