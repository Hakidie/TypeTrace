import { Request, Response } from 'express';
import { getPassageAccess } from '../services/passage-lock.service';

/** The learner's own plan: what it allows and how much of the passage limit they use. No price, no names. */
export const getMyPlan = async (req: Request, res: Response) => {
  const { used, ...access } = await getPassageAccess(req.user!.sub);
  res.json({ ...access, usedPassages: used });
};
