import { Router } from 'express';
import { getToday, startTry } from '../controllers/daily.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

export const dailyRouter = Router();

// Signed-in accounts only, like the typing sessions.
dailyRouter.use(authGuard, requireRole('user', 'admin'));

/** Today's challenge card for the learner: passage, tries left, best, rank, streak, coins, last try, yesterday's winner. */
dailyRouter.get('/', getToday);
/** Starts a try (a `daily` typing session on today's passage); 409 when the 3 tries of the day are used. */
dailyRouter.post('/sessions', startTry);
