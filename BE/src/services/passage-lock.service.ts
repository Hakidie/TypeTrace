// What a learner's plan means for their passages (US11.1): how many count against the limit and which ones are locked.
// Nothing is stored: the lock is worked out from the plan and the passages every time, so buying Premium again, a new
// limit from an admin or deleting a passage opens the older ones with no job to run.
import type { Types } from 'mongoose';
import { AppSettings } from '../models/app-setting.model';
import { PassageModel } from '../models/passage.model';
import type { PlanId } from '../models/subscription.model';
import { UserModel } from '../models/user.model';
import { forbidden } from '../utils/app-error';
import { getAppSettings } from './app-setting.service';
import { getCurrentSubscription } from './subscription.service';

/**
 * The passages a learner made that count against their limit: draft, private, waiting for review, turned down or public.
 * Archived ones and placement passages do not.
 */
const countedFilter = (ownerId: string) => ({ owner: ownerId, status: { $ne: 'archived' as const }, isPlacement: false });

const isAdmin = async (userId: unknown) => (await UserModel.exists({ _id: userId as Types.ObjectId, role: 'admin' })) !== null;

/** The ids of the admin accounts: their passages are system passages (never counted, never locked). */
export const getAdminIds = async () => (await UserModel.find({ role: 'admin' }).select('_id').lean()).map((user) => user._id);

/** A system passage has no owner or an admin's: free for every plan, never locked. */
export const isSystemPassage = async ({ owner }: { owner?: unknown }) => !owner || isAdmin(owner);

/** How many passages of the learner count against their limit (always 0 for an admin). */
export const countCountedPassages = async (ownerId: string) => ((await isAdmin(ownerId)) ? 0 : PassageModel.countDocuments(countedFilter(ownerId)));

/** The plan the learner is on and what it gives. */
export const getPlanOf = async (userId: string) => {
  const [subscription, settings] = await Promise.all([getCurrentSubscription(userId), getAppSettings()]);
  return { plan: subscription.plan, expiresAt: subscription.expiresAt, config: settings.plans[subscription.plan] };
};

/** The passages of one owner past their limit: the newest `maxPassages` stay open, the older ones are locked. */
const lockedOf = async (ownerId: string, plans: AppSettings['plans']) => {
  if (await isAdmin(ownerId)) return [];
  const { plan } = await getCurrentSubscription(ownerId);
  const rows = await PassageModel.find(countedFilter(ownerId))
    .sort({ createdAt: -1, _id: -1 })
    .skip(plans[plan].maxPassages)
    .select('_id')
    .lean();
  return rows.map((row) => row._id);
};

const smallestLimit = (plans: AppSettings['plans']) => Math.min(...(Object.keys(plans) as PlanId[]).map((plan) => plans[plan].maxPassages));

/** The owners with more counted passages than `limit`: only they can have a locked one. */
const ownersOver = async (limit: number) =>
  (
    await PassageModel.aggregate<{ _id: Types.ObjectId }>([
      { $match: { owner: { $exists: true }, status: { $ne: 'archived' }, isPlacement: false } },
      { $group: { _id: '$owner', total: { $sum: 1 } } },
      { $match: { total: { $gt: limit } } }
    ])
  ).map((owner) => owner._id);

/** The ids of the locked passages of `ownerId`, or of every owner. Use them as `_id: { $nin: ids }`. */
export const getLockedPassageIds = async ({ ownerId }: { ownerId?: string } = {}): Promise<Types.ObjectId[]> => {
  const { plans } = await getAppSettings();
  if (ownerId) return lockedOf(ownerId, plans);

  const owners = await ownersOver(smallestLimit(plans));
  return (await Promise.all(owners.map((owner) => lockedOf(String(owner), plans)))).flat();
};

/** What would newly be locked if the plans were these: the owners that lose a passage and how many passages they lose. */
export const previewLockChange = async (next: AppSettings['plans']) => {
  const { plans: current } = await getAppSettings();
  let lockedUsers = 0;
  let lockedPassages = 0;
  for (const owner of await ownersOver(Math.min(smallestLimit(current), smallestLimit(next)))) {
    const before = new Set((await lockedOf(String(owner), current)).map(String));
    const added = (await lockedOf(String(owner), next)).filter((id) => !before.has(String(id))).length;
    if (added > 0) {
      lockedUsers += 1;
      lockedPassages += added;
    }
  }
  return { lockedUsers, lockedPassages };
};

/** What the learner's plan lets them do with passages, and how much of the limit they use. */
export const getPassageAccess = async (userId: string) => {
  const [{ plan, expiresAt, config }, used] = await Promise.all([getPlanOf(userId), countCountedPassages(userId)]);
  return {
    plan,
    expiresAt,
    maxPassages: config.maxPassages,
    used,
    canUsePublicPassages: config.canUsePublicPassages,
    canCreateErrorPractice: config.canCreateErrorPractice
  };
};

/** The public passage of another learner needs Premium (`canUsePublicPassages`): 403 for a plan without it. */
export const assertCanPractice = async (
  userId: string,
  passage: { visibility: string; owner?: unknown }
) => {
  if (passage.visibility !== 'public' || !passage.owner || String(passage.owner) === userId) return;
  if (await isSystemPassage(passage)) return;
  if (!(await getPlanOf(userId)).config.canUsePublicPassages) throw forbidden("Premium is required to practice other learners' passages");
};
