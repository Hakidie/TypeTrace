// The admin side of the plans (US11.1): the two plans, a preview of what a change would lock, and Premium by hand.
import { getAppSettings, updateAppSettings } from './app-setting.service';
import { previewLockChange } from './passage-lock.service';
import { grantPremium, revokePremium } from './subscription.service';
import type { PlanConfig } from '../models/app-setting.model';
import { UserModel } from '../models/user.model';
import { notFound } from '../utils/app-error';
import type { UpdatePlansInput } from '../validators/plan.validator';

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

export const revokeUserPremium = async (adminId: string, userId: string) => {
  await requireUser(userId);
  await revokePremium(userId, adminId);
};
