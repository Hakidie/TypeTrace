import { Router } from 'express';
import { getMyPlan } from '../controllers/plan.controller';
import { authGuard } from '../middlewares/auth.middleware';

export const planRouter = Router();

/** The signed-in learner's plan, its permissions and passage limit (US11.1). */
planRouter.get('/', authGuard, getMyPlan);
