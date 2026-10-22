import { Router } from 'express';
import { createPassage, deletePassage, listPassages } from '../controllers/passage.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParamsSchema } from '../validators/common.validator';
import { createPassageSchema, listPassagesQuerySchema } from '../validators/passage.validator';

export const passageRouter = Router();

// Signed-in accounts only, like the typing sessions.
passageRouter.use(authGuard, requireRole('user', 'admin'));

/** The passages a learner can choose for a `mode`, a page at a time: `{ items: [{ _id, title, wordCount, ownerName, visibility, createdAt }], page, ... }`. */
passageRouter.get('/', validate({ query: listPassagesQuerySchema }), listPassages);
/** The learner's own passages: add one (`{ title?, content }`), delete one. */
passageRouter.post('/', validate({ body: createPassageSchema }), createPassage);
passageRouter.delete('/:id', validate({ params: idParamsSchema }), deletePassage);
