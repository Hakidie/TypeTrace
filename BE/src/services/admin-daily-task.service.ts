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
import { hourlyCompletionsOf } from './user-daily-tasks.service';

/**
 * A page of tasks, each with `completions`: the learners who completed it in each of the last 24 hours and in all of them
 * (`hourlyCompletionsOf`), for the chart of its row.
 */
export const listDailyTasks = async ({ q, type, isActive, ...pagination }: ListDailyTasksQuery) => {
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
  const page = await paginate(DailyTaskModel, filter, pagination, byTitle ? { collation: { locale: 'vi' } } : {});
  const completionsOf = await hourlyCompletionsOf(page.items.map((task) => task._id));
  return { ...page, items: page.items.map((task) => ({ ...task.toJSON(), completions: completionsOf(task._id) })) };
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
  // save() writes only the fields that changed. Of two saves at the same time, one changing the type and the other the
  // target, the task could keep the type of one with the target of the other, a pair nobody checked. Written together,
  // the two are always the set of one save, which the model checked.
  if (task.isModified('type') || task.isModified('target')) {
    task.markModified('type');
    task.markModified('target');
  }
  return task.save();
};

/**
 * A hard delete: the learners' tasks of a day are copies (UserDailyTasks), so theirs stay as they were. Deactivating it
 * instead keeps it for later.
 */
export const deleteDailyTask = async (id: string) => {
  const task = await DailyTaskModel.findByIdAndDelete(id);
  if (!task) throw notFound('Daily task not found');
};

/** The daily task fields of the app settings, the only ones the daily task page shows and changes. */
const dailyTaskSettingsOf = ({ dailyTaskCount }: AppSettings) => ({ dailyTaskCount });

export const getDailyTaskSettings = async () => dailyTaskSettingsOf(await getAppSettings());

export const updateDailyTaskSettings = async (input: DailyTaskSettingsInput) =>
  dailyTaskSettingsOf(await updateAppSettings(input));
