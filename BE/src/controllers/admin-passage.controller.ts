import { Request, Response } from 'express';
import * as passageService from '../services/admin-passage.service';
import {
  BulkRejectPassagesInput,
  CreatePassageInput,
  ListPassagesQuery,
  RejectPassageInput,
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

// The review of learners' requests to make a passage public (SCRUM-176).
export const approvePassage = async (req: Request, res: Response) => {
  res.json(await passageService.approvePassage(idOf(req)));
};

export const rejectPassage = async (req: Request, res: Response) => {
  res.json(await passageService.rejectPassage(idOf(req), (req.body as RejectPassageInput).reason));
};

export const bulkApprovePassages = async (req: Request, res: Response) => {
  res.json({ updated: await passageService.approvePassages((req.body as { ids: string[] }).ids) });
};

export const bulkRejectPassages = async (req: Request, res: Response) => {
  const { ids, reason } = req.body as BulkRejectPassagesInput;
  res.json({ updated: await passageService.rejectPassages(ids, reason) });
};

export const deletePassage = async (req: Request, res: Response) => {
  await passageService.deletePassage(idOf(req));
  res.status(204).end();
};
