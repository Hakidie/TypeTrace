import { Request, Response } from 'express';
import { UserModel } from '../models/user.model';
import { deleteImage, uploadImage } from '../services/cloudinary.service';
import * as dailyProgressService from '../services/daily-progress.service';
import * as errorProfileService from '../services/error-profile.service';
import * as vowelToneService from '../services/vowel-tone.service';
import * as monthlyProgressService from '../services/monthly-progress.service';
import * as userDailyTasksService from '../services/user-daily-tasks.service';
import { updateSettings as saveSettings } from '../services/user.service';
import { badRequest, notFound } from '../utils/app-error';
import type { LanguageQuery } from '../validators/common.validator';
import {
  MonthlyProgressQuery,
  UpdateAvatarSourceInput,
  UpdateProfileInput,
  UpdateSecurityInput,
  UpdateSettingsInput
} from '../validators/profile.validator';

/**
 * Derives the Cloudinary public id from a stored URL. Only used for avatars
 * uploaded before `avatarPublicId` was persisted.
 */
const publicIdFromUrl = (url: string) => {
  const parts = url.split('/');
  const filename = parts[parts.length - 1].replace(/\.[^/.]+$/, '');
  const folder = parts[parts.length - 2];
  return `${folder}/${filename}`;
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  const { displayName, bio, phone } = req.body as UpdateProfileInput;

  const user = await UserModel.findByIdAndUpdate(
    userId,
    { displayName, bio, phone },
    { returnDocument: 'after', runValidators: true }
  );

  if (!user) throw notFound('User not found');
  return res.json(user);
};

export const updateSecurity = async (req: Request, res: Response) => {
  const { loginOtpEnabled } = req.body as UpdateSecurityInput;

  const user = await UserModel.findByIdAndUpdate(req.user?.sub, { loginOtpEnabled }, { returnDocument: 'after' });

  if (!user) throw notFound('User not found');
  return res.json(user);
};

/** The learner's current and longest streak, and today's sessions and daily mission (SCRUM-31). */
export const getStreak = async (req: Request, res: Response) => {
  res.json(await dailyProgressService.getStreak(req.user!.sub));
};

/** Claims today's streak reward: `{ coins, totalCoins }`; 400 without a counted session today, 409 once claimed. */
export const claimStreakReward = async (req: Request, res: Response) => {
  res.json(await dailyProgressService.claimStreakReward(req.user!.sub));
};

/** The learner's daily tasks of today, each with its progress (SCRUM-112). */
export const getDailyTasks = async (req: Request, res: Response) => {
  res.json(await userDailyTasksService.getTodayDailyTasks(req.user!.sub));
};

/**
 * The learner's error profile: rate, level and trend of each error type in their last counted sessions (SCRUM-27), of one
 * typing language (`?language=`, their Practice language when missing, SCRUM-219).
 */
export const getErrorProfile = async (req: Request, res: Response) => {
  const { language } = req.query as LanguageQuery;
  res.json(await errorProfileService.getErrorProfile(req.user!.sub, language));
};

/** The learner's vowel × tone grid: sightings and errors of each vowel with each tone in their last counted Vietnamese sessions (SCRUM-29). */
export const getVowelTone = async (req: Request, res: Response) => {
  res.json(await vowelToneService.getVowelToneGrid(req.user!.sub));
};

/** The learner's WPM and errors of each point of the profile chart: months, weeks or days, by `range` (SCRUM-240), of one typing language. */
export const getMonthlyProgress = async (req: Request, res: Response) => {
  const { range, date, language } = req.query as unknown as MonthlyProgressQuery;
  res.json(await monthlyProgressService.getMonthlyProgress(req.user!.sub, range, date, language));
};

/**
 * Saves the learner's time zone, which the page sends from the browser (SCRUM-31), and the language they type in Practice
 * (SCRUM-219). Answers the user, like `updateProfile`.
 */
export const updateSettings = async (req: Request, res: Response) => {
  res.json(await saveSettings(req.user!.sub, req.body as UpdateSettingsInput));
};

export const uploadAvatar = async (req: Request, res: Response) => {
  const userId = req.user?.sub;

  if (!req.file) throw badRequest('No file provided');

  const user = await UserModel.findById(userId);
  if (!user) throw notFound('User not found');

  const oldPublicId = user.avatarPublicId ?? (user.avatarUrl ? publicIdFromUrl(user.avatarUrl) : undefined);
  if (oldPublicId) {
    await deleteImage(oldPublicId).catch(() => {
      // Non-fatal: old image cleanup failure should not block the upload
    });
  }

  const { url, publicId } = await uploadImage(req.file.buffer, 'avatars');
  user.avatarUrl = url;
  user.avatarPublicId = publicId;
  // A new picture is shown at once, also when the pixel avatar was.
  user.avatarSource = 'picture';
  await user.save();

  return res.json({ avatarUrl: url, publicId, user });
};

/** Shows the uploaded picture or the pixel avatar; the picture is kept while the pixel avatar is shown. Answers the user. */
export const updateAvatarSource = async (req: Request, res: Response) => {
  const { avatarSource } = req.body as UpdateAvatarSourceInput;

  const user = await UserModel.findById(req.user?.sub);
  if (!user) throw notFound('User not found');
  if (avatarSource === 'picture' && !user.avatarUrl) throw badRequest('Upload a picture first');

  user.avatarSource = avatarSource;
  await user.save();
  return res.json(user);
};
