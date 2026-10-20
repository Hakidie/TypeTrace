import { Router } from 'express';
import { listPassages } from '../controllers/passage.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { listPassagesQuerySchema } from '../validators/passage.validator';

export const passageRouter = Router();

// Signed-in accounts only, like the typing sessions.
passageRouter.use(authGuard, requireRole('user', 'admin'));

/** The passages a learner can choose on the Typing page for a `mode`: `{ items: [{ _id, title, wordCount }] }`. */
passageRouter.get('/', validate({ query: listPassagesQuerySchema }), listPassages);
