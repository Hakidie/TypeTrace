import { Router } from 'express';
import { finishPlay, startPlay } from '../controllers/minigame.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParamsSchema } from '../validators/common.validator';
import { startPlaySchema } from '../validators/minigame.validator';

export const minigameRouter = Router();

// Signed-in accounts only, like the minigames themselves.
minigameRouter.use(authGuard, requireRole('user', 'admin'));

/** A minigame of the Minigames tab starts: opens a play and answers its id (SCRUM-300). */
minigameRouter.post('/plays', validate({ body: startPlaySchema }), startPlay);

/** The minigame ended: counts the play for the daily task when it ran long enough; `{ counted }`. */
minigameRouter.post('/plays/:id/finish', validate({ params: idParamsSchema }), finishPlay);
