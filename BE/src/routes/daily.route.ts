import { Router } from 'express';
import { getBoard, getHistory, getToday, startTry } from '../controllers/daily.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { dailyBoardQuerySchema } from '../validators/daily.validator';

export const dailyRouter = Router();

// Signed-in accounts only, like the typing sessions.
dailyRouter.use(authGuard, requireRole('user', 'admin'));

/** Today's challenge card for the learner: passage, tries left, best, rank, streak, coins, last try, yesterday's winner. */
dailyRouter.get('/', getToday);
/** Starts a try (a `daily` typing session on today's passage); 409 when the 3 tries of the day are used. */
dailyRouter.post('/sessions', startTry);
/** The best try of each player of `day` (`today` or `yesterday`), top 20, names and avatars only, and the learner's place. */
dailyRouter.get('/leaderboard', validate({ query: dailyBoardQuerySchema }), getBoard);
/** The learner's best try of each of the last 14 days (`{ days: [{ date, score, wpm, accuracy }] }`, `null` on a day without one), for the progress charts. */
dailyRouter.get('/history', getHistory);
