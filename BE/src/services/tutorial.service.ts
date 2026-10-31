// Ping's tutorial (Ping tutorial design): where a learner is in the tour after sign-up and which modes they learned or
// skipped. It lives on the user; an account without it (from before the tutorial) is never shown one.
import { pingCoach } from '../config/ping-coach';
import { UserModel } from '../models/user.model';
import { AppError, badRequest, notFound } from '../utils/app-error';
import { CoachStats, UpdateTutorialInput } from '../validators/tutorial.validator';
import { generateChatReply } from './ai.service';

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

/** The written tip for these numbers, when the AI cannot answer. */
export const fallbackTip = ({ result, livesLeft }: CoachStats) => {
  if (result === 'loss' && livesLeft === 0) return pingCoach.tips.knockedOut;
  if (result === 'win' && livesLeft === 3) return pingCoach.tips.perfect;
  return pingCoach.tips.default;
};

/**
 * Ping's tip after the practice duel: written by the AI from the numbers of the match, or a written tip when the AI is
 * not set up, out of quota or down, so the learner always gets one.
 */
export const coachTip = async (stats: CoachStats) => {
  const missed = stats.missedWords.length ? stats.missedWords.join(', ') : 'none';
  const text = [
    `Result: ${stats.result}.`,
    `Words typed in time: ${stats.hits}. Words thrown to Ping: ${stats.thrown}. Lives left: ${stats.livesLeft} of 3.`,
    `Match length: ${stats.seconds} s. Words that reached the ground: ${missed}.`
  ].join('\n');
  try {
    return { tip: await generateChatReply([{ role: 'user', text }], pingCoach.systemPrompt), ai: true };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return { tip: fallbackTip(stats), ai: false };
  }
};
