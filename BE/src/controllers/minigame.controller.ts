import { Request, Response } from 'express';
import * as minigamePlayService from '../services/minigame-play.service';
import type { StartPlayInput } from '../validators/minigame.validator';

// `authGuard` runs first, so `req.user` is always set here.
export const startPlay = async (req: Request, res: Response) => {
  const { game } = req.body as StartPlayInput;
  res.status(201).json(await minigamePlayService.startPlay(req.user!.sub, game));
};

export const finishPlay = async (req: Request, res: Response) => {
  res.json(await minigamePlayService.finishPlay(req.user!.sub, String(req.params.id)));
};
