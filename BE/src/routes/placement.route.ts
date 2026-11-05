import { Router } from 'express';
import { getPlacementBoard, getPlacementPassage, getPlacementSettings } from '../controllers/placement.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { placementBoardQuerySchema } from '../validators/placement.validator';

export const placementRouter = Router();

// Signed-in accounts only, like the typing sessions.
placementRouter.use(authGuard, requireRole('user', 'admin'));

/** A random published placement passage (`isPlacement`), public fields only; 404 when there is none. */
placementRouter.get('/', getPlacementPassage);

/**
 * The leaderboard of one placement passage (US10.1), for the current week or all the time: the best session of each active
 * learner, the top 50 and the learner's own place. Names and avatars only.
 */
placementRouter.get('/leaderboard', validate({ query: placementBoardQuerySchema }), getPlacementBoard);

/** The minimum accuracy in use, for the notes of the typing pages (an admin sets it: `/api/admin/placement/settings`). */
placementRouter.get('/settings', getPlacementSettings);
