import { Router } from 'express';
import { getLeaderboard, getMyRanking } from '../controllers/ranked.controller';
import { authGuard, optionalAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { leaderboardQuerySchema, rankingQuerySchema } from '../validators/ranked.validator';

export const rankedRouter = Router();

// A guest may read the leaderboard (SCRUM-256: names and avatars only); the rest is for signed-in accounts.
rankedRouter.get('/leaderboard', optionalAuth, validate({ query: leaderboardQuerySchema }), getLeaderboard);

rankedRouter.use(authGuard);

rankedRouter.get('/me', validate({ query: rankingQuerySchema }), getMyRanking);
