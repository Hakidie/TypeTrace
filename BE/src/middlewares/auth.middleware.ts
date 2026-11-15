import { NextFunction, Request, Response } from 'express';
import { UserModel } from '../models/user.model';
import { forbidden, unauthorized } from '../utils/app-error';
import { verifyToken } from '../utils/jwt';

/**
 * Requires a valid token that does not belong to a locked account. The status is
 * read from the database, so locking a user also stops the tokens they already hold.
 * A token of a deleted user passes here; the handlers answer 404 for it.
 */
export const authGuard = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw unauthorized();

  try {
    req.user = verifyToken(authHeader.slice(7));
  } catch {
    throw unauthorized();
  }

  const user = await UserModel.findById(req.user.sub).select('status');
  if (user?.status === 'locked') throw forbidden('Your account is locked');
  next();
};

/**
 * For read-only pages a guest may open (the leaderboards): a valid token sets `req.user`, no token (or a bad one) leaves it
 * empty and the request goes on as a guest. A locked account is still refused, as in `authGuard`.
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  try {
    verifyToken(authHeader.slice(7));
  } catch {
    return next();
  }
  return authGuard(req, res, next);
};
