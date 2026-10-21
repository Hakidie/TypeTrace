import { Request, Response } from 'express';
import * as themeService from '../services/theme.service';
import {
  CreateThemeInput,
  ListThemesQuery,
  UpdateActiveThemesInput,
  UpdateThemeInput
} from '../validators/theme.validator';

// `authGuard` runs first, so `req.user` is always set here.
const actorOf = (req: Request): themeService.Actor => ({ id: req.user!.sub });

export const listThemes = async (req: Request, res: Response) => {
  res.json(await themeService.listThemes(actorOf(req), req.query as unknown as ListThemesQuery));
};

export const createTheme = async (req: Request, res: Response) => {
  res.status(201).json(await themeService.createTheme(actorOf(req), req.body as CreateThemeInput));
};

export const updateTheme = async (req: Request, res: Response) => {
  res.json(await themeService.updateTheme(actorOf(req), req.params.id as string, req.body as UpdateThemeInput));
};

export const deleteTheme = async (req: Request, res: Response) => {
  await themeService.deleteTheme(actorOf(req), req.params.id as string);
  res.status(204).end();
};

export const getActiveThemes = async (req: Request, res: Response) => {
  res.json(await themeService.getActiveThemes(actorOf(req)));
};

export const updateActiveThemes = async (req: Request, res: Response) => {
  res.json(await themeService.updateActiveThemes(actorOf(req), req.body as UpdateActiveThemesInput));
};
