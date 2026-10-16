import { Request, Response } from 'express';
import * as passageService from '../services/passage.service';

export const getPlacementPassage = async (_req: Request, res: Response) => {
  res.json(await passageService.getPlacementPassage());
};
