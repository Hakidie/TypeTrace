import { Router } from 'express';
import { getPlacementBoard, getPlacementPassage, getPlacementSettings, listPlacementPassages } from '../controllers/placement.controller';
import { authGuard, optionalAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { listPassagesQuerySchema } from '../validators/passage.validator';
import { placementBoardQuerySchema } from '../validators/placement.validator';

export const placementRouter = Router();

// A guest may read the leaderboard and what it needs (SCRUM-256): read-only, names and avatars only. Everything else is for signed-in accounts, like the typing sessions.
/** The placement passages a board can show, for the passage menu of the Leaderboard page; public fields only, no text. */
placementRouter.get('/passages', optionalAuth, validate({ query: listPassagesQuerySchema }), listPlacementPassages);

/**
 * The leaderboard of one placement passage (US10.1), for the current week or all the time: the best session of each active
 * learner, the top 50 and, for a signed-in learner, their own place. Names and avatars only.
 */
placementRouter.get('/leaderboard', optionalAuth, validate({ query: placementBoardQuerySchema }), getPlacementBoard);

/** The minimum accuracy in use, for the notes of the typing pages and the empty board (an admin sets it: `/api/admin/placement/settings`). */
placementRouter.get('/settings', optionalAuth, getPlacementSettings);

placementRouter.use(authGuard, requireRole('user', 'admin'));

/** A random published placement passage (`isPlacement`), public fields only; 404 when there is none. */
placementRouter.get('/', getPlacementPassage);

