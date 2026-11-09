import { Request, Response } from 'express';
import * as adminPlanService from '../services/admin-plan.service';
import type { GrantPremiumInput, ListSubscriptionsQuery, UpdatePlansInput } from '../validators/plan.validator';

export const getPlans = async (_req: Request, res: Response) => {
  res.json(await adminPlanService.getPlans());
};

export const previewPlans = async (req: Request, res: Response) => {
  res.json(await adminPlanService.previewPlans(req.body as UpdatePlansInput));
};

export const savePlans = async (req: Request, res: Response) => {
  res.json(await adminPlanService.savePlans(req.body as UpdatePlansInput));
};

export const grantPremium = async (req: Request, res: Response) => {
  const { months } = req.body as GrantPremiumInput;
  const result = await adminPlanService.grantUserPremium(req.user!.sub, req.params.id as string, months);
  res.json({ plan: result.plan, expiresAt: result.expiresAt });
};

export const cancelPremium = async (req: Request, res: Response) => {
  await adminPlanService.cancelUserPremium(req.params.id as string);
  res.status(204).end();
};

export const revokePremium = async (req: Request, res: Response) => {
  await adminPlanService.revokeUserPremium(req.user!.sub, req.params.id as string);
  res.status(204).end();
};

export const listSubscriptions = async (req: Request, res: Response) => {
  res.json(await adminPlanService.listSubscriptions(req.query as unknown as ListSubscriptionsQuery));
};
