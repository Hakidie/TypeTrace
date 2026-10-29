import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { sendChatMessage } from '../controllers/chat.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { chatRequestSchema } from '../validators/chat.validator';

export const chatRouter = Router();

// Every message costs OpenAI tokens on the project's key, so each signed-in user
// gets a small share.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user!.sub,
  message: { message: 'You are sending messages too fast. Wait a minute and try again.' }
});

chatRouter.post('/', authGuard, chatLimiter, validate({ body: chatRequestSchema }), sendChatMessage);
