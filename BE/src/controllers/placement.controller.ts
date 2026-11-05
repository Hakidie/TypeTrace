import { Request, Response } from 'express';
import * as passageService from '../services/passage.service';
import * as boardService from '../services/placement-board.service';
import type { PlacementBoardQuery } from '../validators/placement.validator';

export const getPlacementPassage = async (_req: Request, res: Response) => {
  res.json(await passageService.getPlacementPassage());
};

export const getPlacementBoard = async (req: Request, res: Response) => {
  res.json(await boardService.getPlacementBoard(req.user!.sub, req.query as unknown as PlacementBoardQuery));
};
