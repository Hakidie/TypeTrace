import { Request, Response } from 'express';
import * as passageService from '../services/passage.service';
import { ListPassagesQuery } from '../validators/passage.validator';

export const listPassages = async (req: Request, res: Response) => {
  const { mode } = req.query as unknown as ListPassagesQuery;
  res.json({ items: await passageService.listPassageOptions(req.user!.sub, mode) });
};
