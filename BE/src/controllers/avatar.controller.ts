import { Request, Response } from 'express';
import * as avatarService from '../services/avatar.service';
import { AvatarLookInput, BuyItemInput } from '../validators/avatar.validator';

// `authGuard` runs first, so `req.user` is always set here.
export const getCatalog = async (req: Request, res: Response) => {
  res.json(await avatarService.getCatalog(req.user!.sub));
};

export const buyItem = async (req: Request, res: Response) => {
  res.json(await avatarService.buyItem(req.user!.sub, (req.body as BuyItemInput).item));
};

export const updateAvatar = async (req: Request, res: Response) => {
  res.json(await avatarService.updateAvatar(req.user!.sub, req.body as AvatarLookInput));
};
