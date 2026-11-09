import { Request, Response } from 'express';
import * as paymentService from '../services/payment.service';
import { badRequest, notFound } from '../utils/app-error';
import { CreatePaymentInput } from '../validators/payment.validator';
import { VnpParams } from '../utils/vnpay';

/** VNPay wants an IPv4-looking address: `::1` and `::ffff:1.2.3.4` become plain IPv4. */
const ipOf = (req: Request) => {
  const ip = req.ip ?? '';
  return ip === '::1' || !ip ? '127.0.0.1' : ip.replace(/^::ffff:/, '');
};

export const createVnpayPayment = async (req: Request, res: Response) => {
  const { product } = req.body as CreatePaymentInput;
  res.status(201).json(await paymentService.createVnpayPayment(req.user!.sub, product, ipOf(req)));
};

/** The learner's browser comes back from VNPay (the front end page forwards the query here). */
export const vnpayReturn = async (req: Request, res: Response) => {
  const outcome = await paymentService.applyVnpayResult(req.query as VnpParams);
  if (!('payment' in outcome)) {
    if (outcome.result === 'not-found') throw notFound('Payment not found');
    throw badRequest(outcome.result === 'invalid-amount' ? 'Invalid amount' : 'Invalid checksum');
  }
  const { status, amount, orderInfo } = outcome.payment;
  res.json({ status, amount, orderInfo });
};

/** VNPay's server calls this (server to server); the answer codes are the ones VNPay documents. */
export const vnpayIpn = async (req: Request, res: Response) => {
  const outcome = await paymentService.applyVnpayResult(req.query as VnpParams);
  const answers = {
    ok: { RspCode: '00', Message: 'Confirm Success' },
    'already-confirmed': { RspCode: '02', Message: 'Order already confirmed' },
    'invalid-signature': { RspCode: '97', Message: 'Invalid Checksum' },
    'not-found': { RspCode: '01', Message: 'Order not found' },
    'invalid-amount': { RspCode: '04', Message: 'Invalid amount' }
  };
  res.json(answers[outcome.result]);
};
