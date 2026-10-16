import { Router } from 'express';
import { getPlacementPassage } from '../controllers/placement.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

export const placementRouter = Router();

// Signed-in accounts only, like the typing sessions.
placementRouter.use(authGuard, requireRole('user', 'admin'));

/** A random published placement passage (`isPlacement`), public fields only; 404 when there is none. */
placementRouter.get('/', getPlacementPassage);
