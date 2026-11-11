import { Router } from 'express';
import {
  abandonSession,
  beginSession,
  completeSession,
  createSession,
  getActivity,
  getSession,
  getSessionReplay,
  getSessionStats,
  listSessions
} from '../controllers/typing-session.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParamsSchema, languageQuerySchema } from '../validators/common.validator';
import {
  completeSessionSchema,
  createSessionSchema,
  listSessionsQuerySchema
} from '../validators/typing-session.validator';

export const typingSessionRouter = Router();

typingSessionRouter.use(authGuard, requireRole('user', 'admin'));

typingSessionRouter.post('/', validate({ body: createSessionSchema }), createSession);
typingSessionRouter.get('/', validate({ query: listSessionsQuerySchema }), listSessions);
/**
 * The learner's own `{ stats?, timezone, sessions }` for the profile page (SCRUM-157, SCRUM-31): their counted sessions
 * per day of their own time zone, from DailyProgress; `stats` of one typing language (`?language=`, SCRUM-219). Before `/:id`,
 * which would take `activity` as an id.
 */
typingSessionRouter.get('/activity', validate({ query: languageQuerySchema }), getActivity);
typingSessionRouter.get('/:id', validate({ params: idParamsSchema }), getSession);
typingSessionRouter.get('/:id/stats', validate({ params: idParamsSchema }), getSessionStats);
/** The replay of a completed session (SCRUM-35), kept 30 days: owner only. */
typingSessionRouter.get('/:id/replay', validate({ params: idParamsSchema }), getSessionReplay);
typingSessionRouter.patch('/:id/begin', validate({ params: idParamsSchema }), beginSession);
typingSessionRouter.patch(
  '/:id/complete',
  validate({ params: idParamsSchema, body: completeSessionSchema }),
  completeSession
);
typingSessionRouter.patch('/:id/abandon', validate({ params: idParamsSchema }), abandonSession);
