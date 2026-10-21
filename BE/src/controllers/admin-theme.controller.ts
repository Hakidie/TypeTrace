import { Request, Response } from 'express';
import * as themeService from '../services/admin-theme.service';
import { CreateAdminThemeInput, ListAdminThemesQuery, UpdateAdminThemeInput } from '../validators/admin-theme.validator';

export const listThemes = async (req: Request, res: Response) => {
  res.json(await themeService.listThemes(req.query as unknown as ListAdminThemesQuery));
};

export const createTheme = async (req: Request, res: Response) => {
  res.status(201).json(await themeService.createTheme(req.body as CreateAdminThemeInput));
};

export const updateTheme = async (req: Request, res: Response) => {
  res.json(await themeService.updateTheme(req.params.id as string, req.body as UpdateAdminThemeInput));
};

export const deleteTheme = async (req: Request, res: Response) => {
  await themeService.deleteTheme(req.params.id as string);
  res.status(204).end();
};
