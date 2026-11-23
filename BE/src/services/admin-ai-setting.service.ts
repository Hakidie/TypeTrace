// The AI settings the admin changes (SCRUM-153): how many passages the AI may write for one learner a day and a minute (Weak spots).
import type { AppSettings } from '../models/app-setting.model';
import type { AiSettingsInput } from '../validators/admin-ai-setting.validator';
import { getAppSettings, updateAppSettings } from './app-setting.service';

const aiSettingsOf = ({ aiLessonsPerDay, aiLessonsPerMinute }: AppSettings) => ({ lessonsPerDay: aiLessonsPerDay, lessonsPerMinute: aiLessonsPerMinute });

export const getAiSettings = async () => aiSettingsOf(await getAppSettings());

export const updateAiSettings = async ({ lessonsPerDay, lessonsPerMinute }: AiSettingsInput) =>
  aiSettingsOf(await updateAppSettings({ aiLessonsPerDay: lessonsPerDay, aiLessonsPerMinute: lessonsPerMinute }));
