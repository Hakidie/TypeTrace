import { Request, Response } from 'express';
import * as adminPaymentService from '../services/admin-payment.service';
import type { ListPaymentsQuery } from '../validators/payment.validator';

export const listPayments = async (req: Request, res: Response) => {
  res.json(await adminPaymentService.listPayments(req.query as unknown as ListPaymentsQuery));
};

export const recheckPayment = async (req: Request, res: Response) => {
  res.json(await adminPaymentService.recheckPayment(req.params.id as string));
};
