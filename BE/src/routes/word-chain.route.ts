import { Router } from 'express';
import { getBoard, saveScore } from '../controllers/word-chain.controller';
import { authGuard, optionalAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { wordChainBoardQuerySchema, wordChainScoreSchema } from '../validators/word-chain.validator';

export const wordChainRouter = Router();

/** The board of this week or of all the time: the best game of each player, the top 20 and the player's own place (a guest may read it, SCRUM-256). */
wordChainRouter.get('/leaderboard', optionalAuth, validate({ query: wordChainBoardQuerySchema }), getBoard);

// The rest is for signed-in accounts, like the other minigames.
wordChainRouter.use(authGuard, requireRole('user', 'admin'));

/** A finished game of Nối từ: the server checks the chain and works out the score itself; 400 when it breaks the rules. */
wordChainRouter.post('/scores', validate({ body: wordChainScoreSchema }), saveScore);
