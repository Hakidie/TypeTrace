import type { QueryFilter } from 'mongoose';
import { NoteModel } from '../models/note.model';
import { TypingSessionModel } from '../models/typing-session.model';
import { UserDocument, UserModel } from '../models/user.model';
import { badRequest, forbidden, notFound } from '../utils/app-error';
import { deleteImage } from './cloudinary.service';
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

/** Days shown in the login heatmap of the admin user list (the frontend draws the same number of cells). */
export const HEATMAP_DAYS = 336;

/** Typing activity of the given users: average speed and accuracy of their completed sessions, and sessions per day. */
const loadActivity = async (ids: unknown[]) => {
  const since = new Date(Date.now() - HEATMAP_DAYS * DAY_MS);
  const [averages, days] = await Promise.all([
    TypingSessionModel.aggregate<{ _id: unknown; wpm: number; accuracy: number }>([
      { $match: { owner: { $in: ids }, status: 'completed', wpm: { $exists: true } } },
      { $group: { _id: '$owner', wpm: { $avg: '$wpm' }, accuracy: { $avg: '$accuracy' } } }
    ]),
    TypingSessionModel.aggregate<{ _id: { owner: unknown; date: string }; sessions: number }>([
      { $match: { owner: { $in: ids }, startedAt: { $gte: since } } },
      {
        $group: {
          _id: { owner: '$owner', date: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } } },
          sessions: { $sum: 1 }
        }
      }
    ])
  ]);
  return { averages, days };
};

/** The users page, each user with `stats` (absent until a session is completed) and `logins` (sessions per day). */
export const listUsers = async ({ q, role, verified, status, ...pagination }: ListUsersQuery) => {
  const filter: QueryFilter<UserDocument> = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (verified !== undefined) filter.isEmailVerified = verified;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ email: pattern }, { displayName: pattern }];
  }
  const page = await paginate(UserModel, filter, pagination);
  const { averages, days } = await loadActivity(page.items.map((user) => user._id));

  const items = page.items.map((user) => {
    const id = String(user._id);
    const average = averages.find((row) => String(row._id) === id);
    return {
      ...user.toJSON(),
      ...(average && { stats: { wpm: Math.round(average.wpm * 10) / 10, accuracy: Math.round(average.accuracy * 10) / 10 } }),
      logins: days.filter((row) => String(row._id.owner) === id).map((row) => ({ date: row._id.date, sessions: row.sessions }))
    };
  });
  return { ...page, items };
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
  return user;
};

/** Deletes users with their notes, typing sessions and avatars. Admins cannot delete themselves. */
export const deleteUsers = async (actorId: string, ids: string[]) => {
  if (ids.includes(actorId)) throw badRequest('You cannot delete your own account here');
  const withAvatar = await UserModel.find({ _id: { $in: ids }, avatarPublicId: { $exists: true } }).select('avatarPublicId');
  const { deletedCount } = await UserModel.deleteMany({ _id: { $in: ids } });
  await NoteModel.deleteMany({ owner: { $in: ids } });
  await TypingSessionModel.deleteMany({ owner: { $in: ids } });
  // Best effort: a failed image cleanup must not undo the delete.
  await Promise.all(withAvatar.map((user) => deleteImage(user.avatarPublicId!).catch(() => undefined)));
  return deletedCount;
};
