// Daily tasks (SCRUM-210): the task templates admins manage, and how many of the active ones a learner gets each day.
import type { QueryFilter } from 'mongoose';
import { AppSettings } from '../models/app-setting.model';
import { DailyTaskDocument, DailyTaskModel } from '../models/daily-task.model';
import { notFound } from '../utils/app-error';
import { paginate } from '../utils/pagination';
import { titleSearchPattern } from '../utils/passage-text';
import {
  CreateDailyTaskInput,
  DailyTaskSettingsInput,
  ListDailyTasksQuery,
  UpdateDailyTaskInput
} from '../validators/admin-daily-task.validator';
import { getAppSettings, updateAppSettings } from './app-setting.service';

export const listDailyTasks = ({ q, type, isActive, ...pagination }: ListDailyTasksQuery) => {
  const filter: QueryFilter<DailyTaskDocument> = {};
  if (type) filter.type = type;
  if (isActive !== undefined) filter.isActive = isActive;
  if (q) {
    // Accents optional, like the passage bank: `go nhanh` finds `Gõ nhanh`.
    const pattern = titleSearchPattern(q);
    filter.$or = [{ title: pattern }, { description: pattern }];
  }
  // Titles sort in Vietnamese order, through the collation of the `title` index of the model.
  const byTitle = pagination.sort.replace(/^-/, '') === 'title';
  return paginate(DailyTaskModel, filter, pagination, byTitle ? { collation: { locale: 'vi' } } : {});
};

export const getDailyTask = async (id: string) => {
  const task = await DailyTaskModel.findById(id);
  if (!task) throw notFound('Daily task not found');
  return task;
};

export const createDailyTask = (input: CreateDailyTaskInput) => DailyTaskModel.create(input);

export const updateDailyTask = async (id: string, input: UpdateDailyTaskInput) => {
  const task = await getDailyTask(id);
  // save() (not findByIdAndUpdate) so the model checks the target against the type the task ends up with.
  task.set(input);
  return task.save();
};

/** A hard delete: nothing else refers to a task. Deactivating it instead keeps it for later. */
export const deleteDailyTask = async (id: string) => {
  const task = await DailyTaskModel.findByIdAndDelete(id);
  if (!task) throw notFound('Daily task not found');
};

/** The daily task fields of the app settings, the only ones the daily task page shows and changes. */
const dailyTaskSettingsOf = ({ dailyTaskCount }: AppSettings) => ({ dailyTaskCount });

export const getDailyTaskSettings = async () => dailyTaskSettingsOf(await getAppSettings());

export const updateDailyTaskSettings = async (input: DailyTaskSettingsInput) =>
  dailyTaskSettingsOf(await updateAppSettings(input));
