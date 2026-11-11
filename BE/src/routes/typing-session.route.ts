import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { weakSpotsAi } from '../config/weak-spots-ai';
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
import { idParamsSchema } from '../validators/common.validator';
import {
  completeSessionSchema,
  createSessionSchema,
  listSessionsQuerySchema
} from '../validators/typing-session.validator';

export const typingSessionRouter = Router();

typingSessionRouter.use(authGuard, requireRole('user', 'admin'));

/**
 * Each Weak spots lesson asks the AI for its passage, on the project's key: `weakSpotsAi.perMinute` a minute per learner. Past
 * it the request is not refused: it goes on without the AI (`res.locals.aiLimited`) and the lesson is the word list (US3.2).
 */
const lessonAiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: weakSpotsAi.perMinute,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => req.user!.sub,
  skip: (req) => (req.body as { mode?: string }).mode !== 'targeted',
  handler: (_req, res, next) => {
    res.locals.aiLimited = true;
    next();
  }
});

typingSessionRouter.post('/', validate({ body: createSessionSchema }), lessonAiLimiter, createSession);
typingSessionRouter.get('/', validate({ query: listSessionsQuerySchema }), listSessions);
/**
 * The learner's own `{ stats?, timezone, sessions }` for the profile page (SCRUM-157, SCRUM-31): their counted sessions
 * per day of their own time zone, from DailyProgress. Before `/:id`, which would take `activity` as an id.
 */
typingSessionRouter.get('/activity', getActivity);
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
