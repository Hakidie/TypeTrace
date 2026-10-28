import { Router } from 'express';
import { createMatch, getMatch, joinMatch, leaveMatch, matchEvents, sendProgress, setReady } from '../controllers/match.controller';
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
matchRouter.post('/:code/progress', validate({ params: matchCodeParamsSchema, body: progressSchema }), sendProgress);
