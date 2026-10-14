import { Router } from 'express';
import {
  abandonSession,
  beginSession,
  completeSession,
  createSession,
  getSession,
  listSessions
} from '../controllers/typing-session.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParamsSchema } from '../validators/common.validator';
import {
  completeSessionSchema,
  createSessionSchema,
  listSessionsQuerySchema
} from '../validators/typing-session.validator';

export const typingSessionRouter = Router();

typingSessionRouter.use(authGuard, requireRole('user', 'admin'));

typingSessionRouter.post('/', validate({ body: createSessionSchema }), createSession);
typingSessionRouter.get('/', validate({ query: listSessionsQuerySchema }), listSessions);
typingSessionRouter.get('/:id', validate({ params: idParamsSchema }), getSession);
typingSessionRouter.patch('/:id/begin', validate({ params: idParamsSchema }), beginSession);
typingSessionRouter.patch(
  '/:id/complete',
  validate({ params: idParamsSchema, body: completeSessionSchema }),
  completeSession
);
typingSessionRouter.patch('/:id/abandon', validate({ params: idParamsSchema }), abandonSession);
