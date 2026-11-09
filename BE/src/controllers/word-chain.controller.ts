import { Request, Response } from 'express';
import * as wordChainService from '../services/word-chain.service';
import type { WordChainBoardQuery } from '../validators/word-chain.validator';

// `authGuard` runs first, so `req.user` is always set here.
export const saveScore = async (req: Request, res: Response) => {
  res.status(201).json(await wordChainService.saveWordChainScore(req.user!.sub, req.body));
};

export const getBoard = async (req: Request, res: Response) => {
  res.json(await wordChainService.getWordChainBoard(req.user!.sub, req.query as unknown as WordChainBoardQuery));
};
