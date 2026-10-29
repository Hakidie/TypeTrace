import { Request, Response } from 'express';
import * as dailyService from '../services/daily.service';
import { DailyBoardQuery } from '../validators/daily.validator';

// `authGuard` runs first, so `req.user` is always set here.
export const getToday = async (req: Request, res: Response) => {
  res.json(await dailyService.getToday(req.user!.sub));
};

export const startTry = async (req: Request, res: Response) => {
  res.status(201).json(await dailyService.startTry(req.user!.sub));
};

export const getBoard = async (req: Request, res: Response) => {
  res.json(await dailyService.getBoard(req.user!.sub, (req.query as unknown as DailyBoardQuery).day));
};
