// The admin side of the plans (US11.1): the two plans, a preview of what a change would lock, and Premium by hand.
import { DEFAULT_AVATAR } from '../data/avatar-catalog';
import { getAppSettings, updateAppSettings } from './app-setting.service';
import { previewLockChange } from './passage-lock.service';
import { cancelPremium, endOf, grantPremium, revokePremium, statusFilter, subscriptionStatus } from './subscription.service';
import type { PlanConfig } from '../models/app-setting.model';
import type { QueryFilter } from 'mongoose';
import { SubscriptionDocument, SubscriptionModel } from '../models/subscription.model';
import { UserModel } from '../models/user.model';
import { paginate } from '../utils/pagination';
import { notFound } from '../utils/app-error';
import type { ListSubscriptionsQuery, UpdatePlansInput } from '../validators/plan.validator';

const planOf = ({ priceVnd, maxPassages, canCreateErrorPractice, canUsePublicPassages }: PlanConfig): PlanConfig => ({
  priceVnd,
  maxPassages,
  canCreateErrorPractice,
  canUsePublicPassages
});

const plansOf = (settings: Awaited<ReturnType<typeof getAppSettings>>) => ({
  free: planOf(settings.plans.free),
  premium: planOf(settings.plans.premium)
});

export const getPlans = async () => plansOf(await getAppSettings());

export const savePlans = async (plans: UpdatePlansInput) => plansOf(await updateAppSettings({ plans }));

/** How many users and passages would newly be locked if `plans` were saved. Saves nothing. */
export const previewPlans = (plans: UpdatePlansInput) => previewLockChange(plans);

const requireUser = async (id: string) => {
  if (!(await UserModel.exists({ _id: id }))) throw notFound('User not found');
};

export const grantUserPremium = async (adminId: string, userId: string, months: number) => {
  await requireUser(userId);
  return grantPremium(userId, months, adminId);
};

/** Premium ends when the paid time does; 400 when the user has none. */
export const cancelUserPremium = async (userId: string) => {
  await requireUser(userId);
  await cancelPremium(userId);
};

export const revokeUserPremium = async (adminId: string, userId: string) => {
  await requireUser(userId);
  await revokePremium(userId, adminId);
};

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The plan terms of all users, newest first. Each row has the user's name (display name, or the email when they have none) and
 * their email (only admins read this) and the name of the admin who changed it (`null` when the system did). Never an id or a password.
 */
export const listSubscriptions = async ({ q, plan, method, by, status, ...pagination }: ListSubscriptionsQuery) => {
  const filter: QueryFilter<SubscriptionDocument> = {};
  if (plan) filter.plan = plan;
  if (method === 'none') filter.source = { $ne: 'payment' };
  const now = new Date();
  if (status) Object.assign(filter, statusFilter(status, now));
  if (by) filter.changedBy = by === 'admin' ? { $ne: null } : null;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    const users = await UserModel.find({ $or: [{ email: pattern }, { displayName: pattern }] }).select('_id');
    filter.user = { $in: users.map((user) => user._id) };
  }
  const page = await paginate(SubscriptionModel, filter, pagination);
  const ids = [...new Set(page.items.flatMap((row) => [String(row.user), ...(row.changedBy ? [String(row.changedBy)] : [])]))];
  const people = await UserModel.find({ _id: { $in: ids } }).select('displayName email avatar avatarUrl avatarSource');
  const nameOf = new Map(people.map((person) => [String(person._id), person.displayName || person.email]));
  const userOf = new Map(people.map((person) => [String(person._id), person]));
  return {
    ...page,
    items: page.items.map((row) => ({
      _id: String(row._id),
      userName: nameOf.get(String(row.user)) ?? 'Unknown',
      email: userOf.get(String(row.user))?.email ?? null,
      // The picture the user shows (none while they chose their pixel avatar) and their pixel avatar, as in the admin user list.
      avatarUrl: userOf.get(String(row.user))?.avatarSource === 'pixel' ? null : (userOf.get(String(row.user))?.avatarUrl ?? null),
      avatar: userOf.get(String(row.user))?.avatar ?? DEFAULT_AVATAR,
      plan: row.plan,
      source: row.source,
      startsAt: row.startsAt,
      endsAt: endOf(row),
      status: subscriptionStatus(row, now),
      changedByName: row.changedBy ? (nameOf.get(String(row.changedBy)) ?? 'Admin') : null,
      createdAt: row.createdAt
    }))
  };
};
