import { Request, Response } from 'express';
import * as dailyService from '../services/daily.service';

// `authGuard` runs first, so `req.user` is always set here.
export const getToday = async (req: Request, res: Response) => {
  res.json(await dailyService.getToday(req.user!.sub));
};

export const startTry = async (req: Request, res: Response) => {
  res.status(201).json(await dailyService.startTry(req.user!.sub));
};
