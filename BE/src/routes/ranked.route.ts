import { Router } from 'express';
import { getLeaderboard, getMyRanking } from '../controllers/ranked.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { leaderboardQuerySchema, rankingQuerySchema } from '../validators/ranked.validator';

export const rankedRouter = Router();

rankedRouter.use(authGuard);

rankedRouter.get('/me', validate({ query: rankingQuerySchema }), getMyRanking);
rankedRouter.get('/leaderboard', validate({ query: leaderboardQuerySchema }), getLeaderboard);
