import { Request, Response } from 'express';
import * as adminPaymentService from '../services/admin-payment.service';
import { getPaymentRevenueOverTime } from '../services/payment-stats.service';
import type { PlanUsersQuery } from '../validators/plan.validator';
import type { ListPaymentsQuery } from '../validators/payment.validator';

export const listPayments = async (req: Request, res: Response) => {
  res.json(await adminPaymentService.listPayments(req.query as unknown as ListPaymentsQuery));
};

export const recheckPayment = async (req: Request, res: Response) => {
  res.json(await adminPaymentService.recheckPayment(req.params.id as string));
};

export const getPaymentRevenue = async (req: Request, res: Response) => {
  const { range, date } = req.query as unknown as PlanUsersQuery;
  res.json({ range, points: await getPaymentRevenueOverTime(range, date) });
};
