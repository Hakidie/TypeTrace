import { Router } from 'express';
import { resetTutorial, startTutorial, updateTutorial } from '../controllers/tutorial.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { updateTutorialSchema } from '../validators/tutorial.validator';

export const tutorialRouter = Router();

/** Right after sign-up: starts the tour (an account that already has a tutorial keeps it). Every route answers the user. */
tutorialRouter.post('/start', authGuard, startTutorial);
/** `{ mode, status }` and/or `{ tour }`: a mode learned or skipped, the tour ended. 400 for an account without a tutorial. */
tutorialRouter.patch('/', authGuard, validateBody(updateTutorialSchema), updateTutorial);
/** "Xem lại hướng dẫn" in Settings: the whole tutorial again. */
tutorialRouter.post('/reset', authGuard, resetTutorial);
