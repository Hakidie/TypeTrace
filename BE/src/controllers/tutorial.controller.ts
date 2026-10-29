import { Request, Response } from 'express';
import * as tutorialService from '../services/tutorial.service';
import { UpdateTutorialInput } from '../validators/tutorial.validator';

export const startTutorial = async (req: Request, res: Response) => {
  res.json(await tutorialService.startTutorial(req.user!.sub));
};

export const updateTutorial = async (req: Request, res: Response) => {
  res.json(await tutorialService.updateTutorial(req.user!.sub, req.body as UpdateTutorialInput));
};

export const resetTutorial = async (req: Request, res: Response) => {
  res.json(await tutorialService.resetTutorial(req.user!.sub));
};
