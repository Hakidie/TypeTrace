import type { QueryFilter } from 'mongoose';
import { DailyProgressModel } from '../models/daily-progress.model';
import { NoteModel } from '../models/note.model';
import { SubscriptionModel } from '../models/subscription.model';
import { SessionReplayModel } from '../models/session-replay.model';
import { TypingSessionModel } from '../models/typing-session.model';
import { UserDailyTasksModel } from '../models/user-daily-tasks.model';
import { UserDocument, UserModel } from '../models/user.model';
import { badRequest, forbidden, notFound } from '../utils/app-error';
import { deleteImage } from './cloudinary.service';
import { placementBoardChanged } from './placement-board-cache';
import { getPremiumExpiries } from './subscription.service';
import { typingActivityOf } from './typing-session.service';
import { paginate } from '../utils/pagination';
import { AdminUpdateUserInput, ListUsersQuery, SetUserStatusInput } from '../validators/admin-user.validator';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Numbers for the admin dashboard. */
export const getAdminStats = async () => {
  const since = new Date(Date.now() - 7 * DAY_MS);
  const [users, admins, verified, newUsersThisWeek, notes] = await Promise.all([
    UserModel.countDocuments(),
    UserModel.countDocuments({ role: 'admin' }),
    UserModel.countDocuments({ isEmailVerified: true }),
    UserModel.countDocuments({ createdAt: { $gte: since } }),
    NoteModel.countDocuments()
  ]);
  return { users, admins, verified, newUsersThisWeek, notes };
};

/** The users page, each user with `stats` (absent until a session is completed) and `sessions` (completed sessions per day). */
export const listUsers = async ({ q, role, verified, status, plan, ...pagination }: ListUsersQuery) => {
  const filter: QueryFilter<UserDocument> = {};
  const premium = await getPremiumExpiries();
  if (plan) filter._id = plan === 'premium' ? { $in: [...premium.keys()] } : { $nin: [...premium.keys()] };
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (verified !== undefined) filter.isEmailVerified = verified;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ email: pattern }, { displayName: pattern }];
  }
  const page = await paginate(UserModel, filter, pagination);
  const activityOf = await typingActivityOf(page.items.map((user) => user._id));
  return {
    ...page,
    items: page.items.map((user) => {
      const live = premium.get(String(user._id));
      return { ...user.toJSON(), ...activityOf(user._id), plan: live ? 'premium' : 'free', planExpiresAt: live?.expiresAt ?? null, planCancelled: live?.cancelled ?? false };
    })
  };
};

export const getUser = async (id: string) => {
  const user = await UserModel.findById(id);
  if (!user) throw notFound('User not found');
  return user;
};

/** `actorId` is the admin making the change: they cannot remove their own admin role. */
export const updateUser = async (actorId: string, id: string, input: AdminUpdateUserInput) => {
  if (id === actorId && input.role && input.role !== 'admin') {
    throw forbidden('You cannot remove your own admin role');
  }
  const user = await UserModel.findByIdAndUpdate(id, input, { returnDocument: 'after', runValidators: true });
  if (!user) throw notFound('User not found');
  return user;
};

/** Locks or unlocks an account. Admins cannot lock themselves or other admins. */
export const setUserStatus = async (actorId: string, id: string, { status }: SetUserStatusInput) => {
  const user = await UserModel.findById(id);
  if (!user) throw notFound('User not found');
  if (status === 'locked') {
    if (id === actorId) throw badRequest('You cannot lock your own account');
    if (user.role === 'admin') throw forbidden('Admin accounts cannot be locked');
  }
  user.status = status;
  user.lockedAt = status === 'locked' ? new Date() : undefined;
  await user.save();
  placementBoardChanged(); // a locked learner has no line on the placement boards, an unlocked one has again
  return user;
};

/**
 * Deletes users with their notes, typing sessions and their replays, days (DailyProgress), daily tasks (UserDailyTasks)
 * and avatars. Admins cannot delete themselves.
 */
export const deleteUsers = async (actorId: string, ids: string[]) => {
  if (ids.includes(actorId)) throw badRequest('You cannot delete your own account here');
  const withAvatar = await UserModel.find({ _id: { $in: ids }, avatarPublicId: { $exists: true } }).select('avatarPublicId');
  const { deletedCount } = await UserModel.deleteMany({ _id: { $in: ids } });
  await NoteModel.deleteMany({ owner: { $in: ids } });
  await TypingSessionModel.deleteMany({ owner: { $in: ids } });
  placementBoardChanged(); // their sessions were on the placement boards
  await SessionReplayModel.deleteMany({ owner: { $in: ids } });
  await DailyProgressModel.deleteMany({ owner: { $in: ids } });
  await UserDailyTasksModel.deleteMany({ owner: { $in: ids } });
  // Their plan history goes with them; their passages stay (shown as anonymous) and count as system passages.
  await SubscriptionModel.deleteMany({ user: { $in: ids } });
  // Best effort: a failed image cleanup must not undo the delete.
  await Promise.all(withAvatar.map((user) => deleteImage(user.avatarPublicId!).catch(() => undefined)));
  return deletedCount;
};
