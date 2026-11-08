import { Router } from 'express';
import {
  emailExists,
  forgotPassword,
  googleLogin,
  getMe,
  login,
  register,
  resetPassword,
  verifyLoginOtp,
  verifyRegisterOtp
} from '../controllers/auth.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { validate, validateBody } from '../middlewares/validate.middleware';
import {
  emailExistsQuerySchema,
  forgotPasswordSchema,
  googleLoginSchema,
  loginSchema,
  otpSchema,
  registerSchema,
  resetPasswordSchema
} from '../validators/auth.validator';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), register);
authRouter.get('/email-exists', validate({ query: emailExistsQuerySchema }), emailExists);
authRouter.post('/register/verify-otp', validateBody(otpSchema), verifyRegisterOtp);
authRouter.post('/login', validateBody(loginSchema), login);
authRouter.post('/login/verify-otp', validateBody(otpSchema), verifyLoginOtp);
authRouter.post('/forgot-password', validateBody(forgotPasswordSchema), forgotPassword);
authRouter.post('/reset-password', validateBody(resetPasswordSchema), resetPassword);
authRouter.post('/google', validateBody(googleLoginSchema), googleLogin);
authRouter.get('/me', authGuard, getMe);
