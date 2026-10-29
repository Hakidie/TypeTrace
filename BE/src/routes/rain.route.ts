import { Router } from 'express';
import { getRainWords } from '../controllers/rain.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

export const rainRouter = Router();

// Signed-in accounts only, like the typing sessions.
rainRouter.use(authGuard, requireRole('user', 'admin'));

/** The words of one round of word rain: `{ words: string[], focus: WordErrorType[] }` (the learner's weak error types). */
rainRouter.get('/words', getRainWords);
