import { Request, Response } from 'express';
import * as dailyTaskService from '../services/admin-daily-task.service';
import {
  CreateDailyTaskInput,
  DailyTaskSettingsInput,
  ListDailyTasksQuery,
  UpdateDailyTaskInput
} from '../validators/admin-daily-task.validator';

const idOf = (req: Request) => req.params.id as string;

export const listDailyTasks = async (req: Request, res: Response) => {
  res.json(await dailyTaskService.listDailyTasks(req.query as unknown as ListDailyTasksQuery));
};

export const getDailyTask = async (req: Request, res: Response) => {
  res.json(await dailyTaskService.getDailyTask(idOf(req)));
};

export const createDailyTask = async (req: Request, res: Response) => {
  res.status(201).json(await dailyTaskService.createDailyTask(req.body as CreateDailyTaskInput));
};

export const updateDailyTask = async (req: Request, res: Response) => {
  res.json(await dailyTaskService.updateDailyTask(idOf(req), req.body as UpdateDailyTaskInput));
};

export const deleteDailyTask = async (req: Request, res: Response) => {
  await dailyTaskService.deleteDailyTask(idOf(req));
  res.status(204).end();
};

export const getDailyTaskSettings = async (_req: Request, res: Response) => {
  res.json(await dailyTaskService.getDailyTaskSettings());
};

export const updateDailyTaskSettings = async (req: Request, res: Response) => {
  res.json(await dailyTaskService.updateDailyTaskSettings(req.body as DailyTaskSettingsInput));
};
