import { Router } from 'express';
import {
  claimStreakReward,
  getDailyTasks,
  getErrorProfile,
  getErrorTrend,
  getMonthlyProgress,
  getStreak,
  getVowelTone,
  updateAvatarSource,
  updateProfile,
  updateSecurity,
  updateSettings,
  uploadAvatar
} from '../controllers/profile.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { imageUpload } from '../middlewares/upload.middleware';
import { validate, validateBody } from '../middlewares/validate.middleware';
import { languageQuerySchema } from '../validators/common.validator';
import {
  monthlyProgressQuerySchema,
  updateAvatarSourceSchema,
  updateProfileSchema,
  updateSecuritySchema,
  updateSettingsSchema
} from '../validators/profile.validator';

export const profileRouter = Router();

profileRouter.patch('/', authGuard, validateBody(updateProfileSchema), updateProfile);
profileRouter.patch('/security', authGuard, validateBody(updateSecuritySchema), updateSecurity);
profileRouter.post('/avatar', authGuard, imageUpload.single('avatar'), uploadAvatar);
/** `{ avatarSource: 'picture' | 'pixel' }`: which avatar the account shows; the uploaded picture is kept. */
profileRouter.patch('/avatar-source', authGuard, validateBody(updateAvatarSourceSchema), updateAvatarSource);
/** The learner's own streak and today's daily mission (SCRUM-31). */
profileRouter.get('/streak', authGuard, getStreak);
/** Claims today's streak reward (coins, once a day, after the day's first counted session). */
profileRouter.post('/streak/reward', authGuard, claimStreakReward);
/** The learner's own daily tasks of today, with their progress (SCRUM-112). */
profileRouter.get('/daily-tasks', authGuard, getDailyTasks);
/**
 * The learner's own error profile: rate, level and trend of each error type in their last counted sessions (SCRUM-27), of
 * one typing language: `?language=vi|en`, their Practice language when missing (SCRUM-219).
 */
profileRouter.get('/error-profile', authGuard, validate({ query: languageQuerySchema }), getErrorProfile);
/** The learner's own error rate of each error type by month, week or day: `?range=`, `?date=` and `?language=` as the monthly progress (SCRUM-30). */
profileRouter.get('/error-trend', authGuard, validate({ query: monthlyProgressQuerySchema }), getErrorTrend);
/** The learner's own vowel × tone grid: sightings and errors of each vowel with each tone, in their last counted Vietnamese sessions (SCRUM-29). */
profileRouter.get('/vowel-tone', authGuard, getVowelTone);
/** The learner's own average WPM and errors by month, week or day: `?range=year|month|week` (SCRUM-240) and `?language=` (SCRUM-219). */
profileRouter.get('/monthly-progress', authGuard, validate({ query: monthlyProgressQuerySchema }), getMonthlyProgress);
/** `{ timezone?, typingLanguage? }`: the zone of the learner's days, sent by the browser (SCRUM-31), and their Practice language (SCRUM-219). */
profileRouter.patch('/settings', authGuard, validateBody(updateSettingsSchema), updateSettings);
