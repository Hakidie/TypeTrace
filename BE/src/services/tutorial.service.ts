// Ping's tutorial (Ping tutorial design): where a learner is in the tour after sign-up and which modes they learned or
// skipped. It lives on the user; an account without it (from before the tutorial) is never shown one.
import { UserModel } from '../models/user.model';
import { badRequest, notFound } from '../utils/app-error';
import { UpdateTutorialInput } from '../validators/tutorial.validator';

const FRESH = { tour: 'active', modes: {} } as const;

/** Starts the tour of a new account; an account that already has a tutorial keeps it. Answers the user. */
export const startTutorial = async (userId: string) => {
  await UserModel.updateOne({ _id: userId, tutorial: { $exists: false } }, { $set: { tutorial: FRESH } });
  const user = await UserModel.findById(userId);
  if (!user) throw notFound('User not found');
  return user;
};

/** A mode learned or skipped, or the tour ended. Only for an account with a tutorial. Answers the user. */
export const updateTutorial = async (userId: string, { mode, status, tour }: UpdateTutorialInput) => {
  const set: Record<string, string> = {};
  if (mode && status) set[`tutorial.modes.${mode}`] = status;
  if (tour) set['tutorial.tour'] = tour;
  const user = await UserModel.findOneAndUpdate({ _id: userId, tutorial: { $exists: true } }, { $set: set }, { returnDocument: 'after' });
  if (!user) throw badRequest('This account has no tutorial');
  return user;
};

/** "Xem lại hướng dẫn" in Settings: the whole tutorial again, also for an account from before it. Answers the user. */
export const resetTutorial = async (userId: string) => {
  const user = await UserModel.findByIdAndUpdate(userId, { $set: { tutorial: FRESH } }, { returnDocument: 'after' });
  if (!user) throw notFound('User not found');
  return user;
};
