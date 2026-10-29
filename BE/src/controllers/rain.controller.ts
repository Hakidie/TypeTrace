import { Request, Response } from 'express';
import * as rainService from '../services/rain.service';

// `authGuard` runs first, so `req.user` is always set here.
export const getRainWords = async (req: Request, res: Response) => {
  res.json(await rainService.rainWordsFor(req.user!.sub));
};
