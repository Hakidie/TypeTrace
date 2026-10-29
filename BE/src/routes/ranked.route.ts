import { Router } from 'express';
import { getLeaderboard, getMyRanking } from '../controllers/ranked.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { leaderboardQuerySchema } from '../validators/ranked.validator';

export const rankedRouter = Router();

rankedRouter.use(authGuard);

rankedRouter.get('/me', getMyRanking);
rankedRouter.get('/leaderboard', validate({ query: leaderboardQuerySchema }), getLeaderboard);
