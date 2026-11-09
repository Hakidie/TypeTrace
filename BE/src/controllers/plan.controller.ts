import { Request, Response } from 'express';
import { getPlans } from '../services/admin-plan.service';
import { getPassageAccess } from '../services/passage-lock.service';

/** The learner's own plan: what it allows and how much of the passage limit they use, and both plans with their price to show them side by side. No names. */
export const getMyPlan = async (req: Request, res: Response) => {
  const [{ used, ...access }, plans] = await Promise.all([getPassageAccess(req.user!.sub), getPlans()]);
  res.json({ ...access, usedPassages: used, plans });
};
