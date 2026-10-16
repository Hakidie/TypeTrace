import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorMiddleware } from './middlewares/error.middleware';
import { notFoundHandler } from './middlewares/not-found.middleware';
import { adminRouter } from './routes/admin.route';
import { authRouter } from './routes/auth.route';
import { chatRouter } from './routes/chat.route';
import { noteRouter } from './routes/note.route';
import { placementRouter } from './routes/placement.route';
import { profileRouter } from './routes/profile.route';
import { typingSessionRouter } from './routes/typing-session.route';

export const app = express();

const isTest = env.nodeEnv === 'test';

if (env.trustProxy > 0) app.set('trust proxy', env.trustProxy);

app.use(helmet());
app.use(cors({ origin: env.clientUrl }));
app.use(express.json());
if (!isTest) app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, skip: () => isTest }));

// Stricter limit for credential and OTP endpoints. `/me` is read on every page
// load, so it is left to the global limiter.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later' },
  skip: (req) => isTest || req.path === '/me'
});

app.get('/', (_req, res) => {
  res.json({ message: 'Welcome to the API' });
});

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notes', noteRouter);
app.use('/api/sessions', typingSessionRouter);
app.use('/api/placement', placementRouter);
app.use(notFoundHandler);
app.use(errorMiddleware);
