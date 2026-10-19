import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { authGuard } from '../../src/middlewares/auth.middleware';
import { signToken } from '../../src/utils/jwt';
import { createUser } from '../helpers/user-factory';

const buildContext = (authorization?: string) => {
  const req = { headers: authorization ? { authorization } : {} } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
};

// Failures are thrown as AppError; Express 5 forwards them to the error middleware.
const expectRejected = async (header: string | undefined, status: number) => {
  const { req, res, next } = buildContext(header);
  await expect(authGuard(req, res, next)).rejects.toMatchObject({ status });
  expect(next).not.toHaveBeenCalled();
};

describe('authGuard', () => {
  it('passes a valid Bearer token through and exposes the payload', async () => {
    const user = await createUser();
    const token = signToken({ sub: String(user._id), email: user.email });
    const { req, res, next } = buildContext(`Bearer ${token}`);

    await authGuard(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ sub: String(user._id), email: user.email });
  });

  it('rejects a request with no Authorization header', () => expectRejected(undefined, 401));

  it.each(['Basic abc', 'bearer lowercase-scheme', 'Bearer', 'abc.def.ghi'])('rejects malformed header %j', (header) =>
    expectRejected(header, 401)
  );

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: 'user-id', email: 'user@example.com' }, process.env.JWT_SECRET as string, {
      expiresIn: '-1s'
    });
    return expectRejected(`Bearer ${expired}`, 401);
  });

  it('rejects a token signed with a foreign secret', () => {
    const foreign = jwt.sign({ sub: 'user-id', email: 'user@example.com' }, 'foreign_secret');
    return expectRejected(`Bearer ${foreign}`, 401);
  });

  it('rejects a valid token of a locked user with 403', async () => {
    const user = await createUser({ status: 'locked' });
    return expectRejected(`Bearer ${signToken({ sub: String(user._id), email: user.email })}`, 403);
  });
});
