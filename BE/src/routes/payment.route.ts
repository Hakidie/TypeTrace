import { Router } from 'express';
import { createVnpayPayment, vnpayIpn, vnpayReturn } from '../controllers/payment.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createPaymentSchema, vnpayQuerySchema } from '../validators/payment.validator';

export const paymentRouter = Router();

paymentRouter.post('/vnpay', authGuard, requireRole('user', 'admin'), validate({ body: createPaymentSchema }), createVnpayPayment);
// Not signed in: the checksum from VNPay is the proof (`verifyVnpay`).
paymentRouter.get('/vnpay/return', validate({ query: vnpayQuerySchema }), vnpayReturn);
paymentRouter.get('/vnpay/ipn', validate({ query: vnpayQuerySchema }), vnpayIpn);
