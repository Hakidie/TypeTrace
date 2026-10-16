import { Request, Response } from 'express';
import * as passageService from '../services/admin-passage.service';
import {
  CreatePassageInput,
  ListPassagesQuery,
  SetPassageStatusInput,
  UpdatePassageInput
} from '../validators/admin-passage.validator';

const idOf = (req: Request) => req.params.id as string;

export const listPassages = async (req: Request, res: Response) => {
  res.json(await passageService.listPassages(req.query as unknown as ListPassagesQuery));
};

export const getPassage = async (req: Request, res: Response) => {
  res.json(await passageService.getPassage(idOf(req)));
};

export const createPassage = async (req: Request, res: Response) => {
  res.status(201).json(await passageService.createPassage(req.user!.sub, req.body as CreatePassageInput));
};

export const updatePassage = async (req: Request, res: Response) => {
  res.json(await passageService.updatePassage(idOf(req), req.body as UpdatePassageInput));
};

export const setPassageStatus = async (req: Request, res: Response) => {
  res.json(await passageService.setPassageStatus(idOf(req), (req.body as SetPassageStatusInput).status));
};

export const deletePassage = async (req: Request, res: Response) => {
  await passageService.deletePassage(idOf(req));
  res.status(204).end();
};
