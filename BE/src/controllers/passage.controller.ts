import { Request, Response } from 'express';
import * as passageService from '../services/passage.service';
import { CreatePassageInput, ListPassagesQuery } from '../validators/passage.validator';

// `authGuard` runs first, so `req.user` is always set here.
const userIdOf = (req: Request) => req.user!.sub;
const idOf = (req: Request) => req.params.id as string;

export const listPassages = async (req: Request, res: Response) => {
  res.json(await passageService.listPassages(userIdOf(req), req.query as unknown as ListPassagesQuery));
};

export const createPassage = async (req: Request, res: Response) => {
  res.status(201).json(await passageService.createPassage(userIdOf(req), req.body as CreatePassageInput));
};

export const deletePassage = async (req: Request, res: Response) => {
  await passageService.deletePassage(userIdOf(req), idOf(req));
  res.status(204).end();
};

// No body: what the client might send (a status, a visibility) is never read.
export const requestPublication = async (req: Request, res: Response) => {
  res.json(await passageService.requestPublication(userIdOf(req), idOf(req)));
};

export const withdrawPublicationRequest = async (req: Request, res: Response) => {
  res.json(await passageService.withdrawPublicationRequest(userIdOf(req), idOf(req)));
};
