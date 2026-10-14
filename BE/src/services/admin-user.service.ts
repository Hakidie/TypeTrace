import type { QueryFilter } from 'mongoose';
import { NoteModel } from '../models/note.model';
import { TypingSessionModel } from '../models/typing-session.model';
import { UserDocument, UserModel } from '../models/user.model';
import { badRequest, forbidden, notFound } from '../utils/app-error';
import { deleteImage } from './cloudinary.service';
import { paginate } from '../utils/pagination';
import { AdminUpdateUserInput, ListUsersQuery } from '../validators/admin-user.validator';

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

export const listUsers = ({ q, role, verified, ...pagination }: ListUsersQuery) => {
  const filter: QueryFilter<UserDocument> = {};
  if (role) filter.role = role;
  if (verified !== undefined) filter.isEmailVerified = verified;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ email: pattern }, { displayName: pattern }];
  }
  return paginate(UserModel, filter, pagination);
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
