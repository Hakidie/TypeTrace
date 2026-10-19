import { Request, Response } from 'express';
import * as adminUserService from '../services/admin-user.service';
import { notFound } from '../utils/app-error';
import { AdminUpdateUserInput, ListUsersQuery, SetUserStatusInput } from '../validators/admin-user.validator';

// `authGuard` runs first, so `req.user` is always set here.
const actorId = (req: Request) => req.user!.sub;

export const getStats = async (_req: Request, res: Response) => {
  res.json(await adminUserService.getAdminStats());
};

export const listUsers = async (req: Request, res: Response) => {
  res.json(await adminUserService.listUsers(req.query as unknown as ListUsersQuery));
};

export const getUser = async (req: Request, res: Response) => {
  res.json(await adminUserService.getUser(req.params.id as string));
};

export const updateUser = async (req: Request, res: Response) => {
  res.json(await adminUserService.updateUser(actorId(req), req.params.id as string, req.body as AdminUpdateUserInput));
};

export const setUserStatus = async (req: Request, res: Response) => {
  res.json(await adminUserService.setUserStatus(actorId(req), req.params.id as string, req.body as SetUserStatusInput));
};

export const deleteUser = async (req: Request, res: Response) => {
  const deleted = await adminUserService.deleteUsers(actorId(req), [req.params.id as string]);
  if (!deleted) throw notFound('User not found');
  res.status(204).end();
};

export const bulkDeleteUsers = async (req: Request, res: Response) => {
  const deleted = await adminUserService.deleteUsers(actorId(req), (req.body as { ids: string[] }).ids);
  res.json({ deleted });
};
