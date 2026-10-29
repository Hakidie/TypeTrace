// The settings of the whole app (SCRUM-210): the one AppSetting document (app-setting.model.ts).
import { APP_SETTINGS_KEY, AppSettingModel, AppSettings } from '../models/app-setting.model';

/** The settings in use: the saved document, or the defaults of the model while no admin has saved any. Never writes. */
export const getAppSettings = async () => (await AppSettingModel.findOne({ key: APP_SETTINGS_KEY })) ?? new AppSettingModel();

/** Saves `changes` (only the fields given, the others keep their value) and answers the settings saved. */
export const updateAppSettings = async (changes: Partial<AppSettings>) => {
  // One atomic upsert: the first save creates the document, the unique `key` keeps it one.
  const settings = await AppSettingModel.findOneAndUpdate(
    { key: APP_SETTINGS_KEY },
    { $set: changes },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
  return settings!;
};
