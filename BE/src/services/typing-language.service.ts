// The language a learner types in Practice (SCRUM-219, US2.7). Only models are imported, so every service may read it
// without starting a service cycle (see `service-imports.test.ts`).
import { UserModel } from '../models/user.model';
import { notFound } from '../utils/app-error';
import type { TypingLanguage } from '../utils/typing-language';

/** The learner's `settings.typingLanguage` (`vi` on an account saved before it). A deleted account answers 404. */
export const typingLanguageOf = async (userId: string): Promise<TypingLanguage> => {
  const user = await UserModel.findById(userId).select('settings.typingLanguage').lean();
  if (!user) throw notFound('User not found');
  return user.settings?.typingLanguage ?? 'vi';
};
