import { Request, Response } from 'express';
import * as matchService from '../services/match.service';
import { CreateMatchInput, ProgressInput, RainWordInput } from '../validators/match.validator';

// `authGuard` runs first, so `req.user` is always set; `validate` upper-cased the code.
const userOf = (req: Request) => req.user!.sub;
const codeOf = (req: Request) => req.params.code as string;

export const createMatch = async (req: Request, res: Response) => {
  res.status(201).json(await matchService.createMatch(userOf(req), (req.body as CreateMatchInput).kind));
};

export const joinMatch = async (req: Request, res: Response) => {
  res.json(await matchService.joinMatch(userOf(req), codeOf(req)));
};

export const getMatch = async (req: Request, res: Response) => {
  res.json(await matchService.getMatch(userOf(req), codeOf(req)));
};

export const leaveMatch = async (req: Request, res: Response) => {
  res.json(await matchService.leaveMatch(userOf(req), codeOf(req)));
};

export const setReady = async (req: Request, res: Response) => {
  res.json(await matchService.setReady(userOf(req), codeOf(req), (req.body as { ready: boolean }).ready));
};

export const sendProgress = async (req: Request, res: Response) => {
  res.json(await matchService.sendProgress(userOf(req), codeOf(req), req.body as ProgressInput));
};

export const requestRematch = async (req: Request, res: Response) => {
  res.status(201).json(await matchService.requestRematch(userOf(req), codeOf(req)));
};

/** An event stream (SSE): the service keeps the response open. */
export const matchEvents = async (req: Request, res: Response) => {
  await matchService.openEvents(userOf(req), codeOf(req), res);
};

export const submitRainWord = async (req: Request, res: Response) => {
  res.json(await matchService.submitRainWord(userOf(req), codeOf(req), (req.body as RainWordInput).text));
};
