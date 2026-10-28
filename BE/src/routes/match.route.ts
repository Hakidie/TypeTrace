import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { createMatch, getMatch, joinMatch, leaveMatch, matchEvents, requestRematch, sendProgress, setReady } from '../controllers/match.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { matchCodeParamsSchema, progressSchema, readySchema } from '../validators/match.validator';

export const matchRouter = Router();

// Signed-in accounts only. The event stream reads the token from the `Authorization` header too (the frontend uses
// `fetch`, not `EventSource`), so a token never goes in a URL.
matchRouter.use(authGuard);

const withCode = validate({ params: matchCodeParamsSchema });

matchRouter.post('/', createMatch);
matchRouter.get('/:code', withCode, getMatch);
matchRouter.get('/:code/events', withCode, matchEvents);
matchRouter.post('/:code/join', withCode, joinMatch);
matchRouter.post('/:code/leave', withCode, leaveMatch);
matchRouter.post('/:code/ready', validate({ params: matchCodeParamsSchema, body: readySchema }), setReady);
// Several progress reports a second while typing: a limit per player of its own (the global limit skips this path).
const progressLimiter = rateLimit({
  windowMs: 1000,
  max: 20,
  keyGenerator: (req) => req.user!.sub,
  skip: () => env.nodeEnv === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many progress reports, slow down' }
});
matchRouter.post('/:code/progress', progressLimiter, validate({ params: matchCodeParamsSchema, body: progressSchema }), sendProgress);
matchRouter.post('/:code/rematch', withCode, requestRematch);
