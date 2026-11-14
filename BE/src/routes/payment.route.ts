import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { createMomoPayment, createVnpayPayment, createPayosPayment, listProducts, momoIpn, momoReturn, payosReturn, payosWebhook, vnpayIpn, vnpayReturn } from '../controllers/payment.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createPaymentSchema, momoResultSchema, payosReturnSchema, payosWebhookSchema, vnpayQuerySchema } from '../validators/payment.validator';

export const paymentRouter = Router();

// Each try saves a pending payment: a learner may start 10 an hour.
const startLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user!.sub,
  skip: () => env.nodeEnv === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many payments started, please try again later' }
});

paymentRouter.get('/products', authGuard, listProducts);
paymentRouter.post('/vnpay', authGuard, requireRole('user', 'admin'), startLimiter, validate({ body: createPaymentSchema }), createVnpayPayment);
// Not signed in: the checksum from VNPay is the proof (`verifyVnpay`).
paymentRouter.get('/vnpay/return', validate({ query: vnpayQuerySchema }), vnpayReturn);
paymentRouter.get('/vnpay/ipn', validate({ query: vnpayQuerySchema }), vnpayIpn);

// MoMo next to VNPay: the same catalog, limit and rules. The `signature` MoMo sends is the proof (`verifyMomo`).
paymentRouter.post('/momo', authGuard, requireRole('user', 'admin'), startLimiter, validate({ body: createPaymentSchema }), createMomoPayment);
paymentRouter.get('/momo/return', validate({ query: momoResultSchema }), momoReturn);
paymentRouter.post('/momo/ipn', validate({ body: momoResultSchema }), momoIpn);

// payOS: the same catalog, limit and rules. The webhook's signature is the proof (`verifyPayos`); the return asks payOS itself.
paymentRouter.post('/payos', authGuard, requireRole('user', 'admin'), startLimiter, validate({ body: createPaymentSchema }), createPayosPayment);
paymentRouter.get('/payos/return', validate({ query: payosReturnSchema }), payosReturn);
paymentRouter.post('/payos/webhook', validate({ body: payosWebhookSchema }), payosWebhook);
