import { Router } from 'express';
import {
  abandonSession,
  beginSession,
  completeSession,
  createSession,
  getActivity,
  getSession,
  getSessionStats,
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
/** The learner's own `{ stats?, sessions }` for the profile page (SCRUM-157). Before `/:id`, which would take `activity` as an id. */
typingSessionRouter.get('/activity', getActivity);
typingSessionRouter.get('/:id', validate({ params: idParamsSchema }), getSession);
typingSessionRouter.get('/:id/stats', validate({ params: idParamsSchema }), getSessionStats);
typingSessionRouter.patch('/:id/begin', validate({ params: idParamsSchema }), beginSession);
typingSessionRouter.patch(
  '/:id/complete',
  validate({ params: idParamsSchema, body: completeSessionSchema }),
  completeSession
);
typingSessionRouter.patch('/:id/abandon', validate({ params: idParamsSchema }), abandonSession);
