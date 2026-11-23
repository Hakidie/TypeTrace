import { Request, Response } from 'express';
import * as aiSettingService from '../services/admin-ai-setting.service';
import type { AiSettingsInput } from '../validators/admin-ai-setting.validator';

export const getAiSettings = async (_req: Request, res: Response) => {
  res.json(await aiSettingService.getAiSettings());
};

export const updateAiSettings = async (req: Request, res: Response) => {
  res.json(await aiSettingService.updateAiSettings(req.body as AiSettingsInput));
};
