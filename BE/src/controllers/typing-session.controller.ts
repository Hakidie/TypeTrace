import { Request, Response } from 'express';
import * as sessionService from '../services/typing-session.service';
import { CompleteSessionInput, CreateSessionInput, ListSessionsQuery } from '../validators/typing-session.validator';

// `authGuard` runs first, so `req.user` is always set here.
const userIdOf = (req: Request) => req.user!.sub;

export const createSession = async (req: Request, res: Response) => {
  res.status(201).json(await sessionService.startSession(userIdOf(req), req.body as CreateSessionInput));
};

export const listSessions = async (req: Request, res: Response) => {
  res.json(await sessionService.listSessions(userIdOf(req), req.query as unknown as ListSessionsQuery));
};

export const getActivity = async (req: Request, res: Response) => {
  res.json(await sessionService.getOwnActivity(userIdOf(req)));
};

export const getSession = async (req: Request, res: Response) => {
  res.json(await sessionService.getSession(userIdOf(req), req.params.id as string));
};

export const beginSession = async (req: Request, res: Response) => {
  res.json(await sessionService.beginSession(userIdOf(req), req.params.id as string));
};

export const completeSession = async (req: Request, res: Response) => {
  res.json(await sessionService.completeSession(userIdOf(req), req.params.id as string, req.body as CompleteSessionInput));
};

export const abandonSession = async (req: Request, res: Response) => {
  res.json(await sessionService.abandonSession(userIdOf(req), req.params.id as string));
};
