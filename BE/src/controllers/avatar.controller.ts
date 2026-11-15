import { Request, Response } from 'express';
import * as avatarService from '../services/avatar.service';
import { AvatarLookInput, BuyItemInput } from '../validators/avatar.validator';

// The catalog is open to guests (`optionalAuth`, SCRUM-251): a guest gets the catalog to try items on. The other handlers run after `authGuard`, so `req.user` is always set there.
export const getCatalog = async (req: Request, res: Response) => {
  res.json(req.user ? await avatarService.getCatalog(req.user.sub) : avatarService.getGuestCatalog());
};

export const buyItem = async (req: Request, res: Response) => {
  res.json(await avatarService.buyItem(req.user!.sub, (req.body as BuyItemInput).item));
};

export const updateAvatar = async (req: Request, res: Response) => {
  res.json(await avatarService.updateAvatar(req.user!.sub, req.body as AvatarLookInput));
};
