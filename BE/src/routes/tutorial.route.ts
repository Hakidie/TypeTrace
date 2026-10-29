import { Router } from 'express';
import { getCoachTip, resetTutorial, startTutorial, updateTutorial } from '../controllers/tutorial.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { coachStatsSchema, updateTutorialSchema } from '../validators/tutorial.validator';
import { chatLimiter } from './chat.route';

export const tutorialRouter = Router();

/** Right after sign-up: starts the tour (an account that already has a tutorial keeps it). Every route answers the user. */
tutorialRouter.post('/start', authGuard, startTutorial);
/** `{ mode, status }` and/or `{ tour }`: a mode learned or skipped, the tour ended. 400 for an account without a tutorial. */
tutorialRouter.patch('/', authGuard, validateBody(updateTutorialSchema), updateTutorial);
/** "Xem lại hướng dẫn" in Settings: the whole tutorial again. */
tutorialRouter.post('/reset', authGuard, resetTutorial);
/** The numbers of a practice duel → `{ tip, ai }`: Ping's tip (AI, or a written one when the AI cannot answer). Shares the chat's 10 a minute. */
tutorialRouter.post('/coach', authGuard, chatLimiter, validateBody(coachStatsSchema), getCoachTip);
