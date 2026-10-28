import { Router } from 'express';
import { getStreak, updateProfile, updateSecurity, updateSettings, uploadAvatar } from '../controllers/profile.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { imageUpload } from '../middlewares/upload.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { updateProfileSchema, updateSecuritySchema, updateSettingsSchema } from '../validators/profile.validator';

export const profileRouter = Router();

profileRouter.patch('/', authGuard, validateBody(updateProfileSchema), updateProfile);
profileRouter.patch('/security', authGuard, validateBody(updateSecuritySchema), updateSecurity);
profileRouter.post('/avatar', authGuard, imageUpload.single('avatar'), uploadAvatar);
/** The learner's own streak and today's daily mission (SCRUM-31). */
profileRouter.get('/streak', authGuard, getStreak);
/** `{ timezone }`: the zone of the learner's days, sent by the browser (SCRUM-31). */
profileRouter.patch('/settings', authGuard, validateBody(updateSettingsSchema), updateSettings);
