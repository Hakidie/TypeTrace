import { MAX_USER_THEMES, ThemeDocument, ThemeModel } from '../models/theme.model';
import { UserModel } from '../models/user.model';
import { badRequest, conflict, notFound } from '../utils/app-error';
import { isDarkBackground } from '../utils/theme-colors';
import { CreateThemeInput, ListThemesQuery, UpdateActiveThemesInput, UpdateThemeInput } from '../validators/theme.validator';

export interface Actor {
  id: string;
}

/** Themes the actor may see and use: the published ones and their own. Another user's theme answers 404. */
const visibleTo = (actor: Actor) => ({ $or: [{ published: true }, { owner: actor.id }] });

/** The actor's own, private themes: the only ones they may rename, recolor or delete. */
const ownedBy = (actor: Actor, id?: string) => ({ ...(id ? { _id: id } : {}), owner: actor.id, published: false });

const isDuplicateKey = (error: unknown) => (error as { code?: number }).code === 11000;

const nameTaken = () => conflict('You already have a theme with this name');

/** `isDark`: the background of the colors that were sent. */
export const wrongMode = (isDark: boolean) => {
  const message = isDark
    ? 'The background is too dark for a light theme. Switch to Dark mode to use these colors.'
    : 'The background is too light for a dark theme. Switch to Light mode to use these colors.';
  return badRequest(message, [{ field: 'colors.background', message }]);
};

export const listThemes = (actor: Actor, { isDark }: ListThemesQuery) =>
  ThemeModel.find({ ...visibleTo(actor), ...(isDark === undefined ? {} : { isDark }) }).sort({ published: -1, nameLower: 1 });

export const createTheme = async (actor: Actor, input: CreateThemeInput) => {
  const user = await UserModel.findById(actor.id).select('settings displayName email');
  if (!user) throw notFound('User not found');

  // A theme is made for the mode in use: its background must fit that mode.
  const isDark = isDarkBackground(input.colors.background);
  if (isDark !== (user.settings.mode === 'dark')) throw wrongMode(isDark);

  if ((await ThemeModel.countDocuments(ownedBy(actor))) >= MAX_USER_THEMES) {
    throw badRequest(`You can have at most ${MAX_USER_THEMES} themes`);
  }
  if (await ThemeModel.exists({ owner: actor.id, nameLower: input.name.toLowerCase() })) throw nameTaken();

  try {
    return await ThemeModel.create({
      ...input,
      isDark,
      owner: actor.id,
      ownerName: user.displayName || user.email,
      published: false
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw nameTaken();
    throw error;
  }
};

export const updateTheme = async (actor: Actor, id: string, input: UpdateThemeInput) => {
  const theme = await ThemeModel.findOne(ownedBy(actor, id));
  if (!theme) throw notFound('Theme not found');

  if (input.colors) {
    // Recoloring cannot move a theme to the other mode: the themes chosen for each mode would break.
    const isDark = isDarkBackground(input.colors.background);
    if (isDark !== theme.isDark) throw wrongMode(isDark);
    theme.colors = input.colors;
  }
  if (input.name !== undefined) {
    const taken = await ThemeModel.exists({ owner: actor.id, nameLower: input.name.toLowerCase(), _id: { $ne: id } });
    if (taken) throw nameTaken();
    theme.name = input.name;
  }

  try {
    return await theme.save();
  } catch (error) {
    if (isDuplicateKey(error)) throw nameTaken();
    throw error;
  }
};

export const deleteTheme = async (actor: Actor, id: string) => {
  const theme = await ThemeModel.findOneAndDelete(ownedBy(actor, id));
  if (!theme) throw notFound('Theme not found');

  // A mode that used the deleted theme goes back to its fallback.
  await UserModel.updateOne({ _id: actor.id, 'settings.darkTheme': id }, { $set: { 'settings.darkTheme': null } });
  await UserModel.updateOne({ _id: actor.id, 'settings.lightTheme': id }, { $set: { 'settings.lightTheme': null } });
};

/**
 * The mode in use and the theme of each mode. A theme that was deleted, or is no longer allowed, is answered as
 * `null`, so the app shows the fallback instead of failing.
 */
export const getActiveThemes = async (actor: Actor) => {
  const user = await UserModel.findById(actor.id).select('settings');
  if (!user) throw notFound('User not found');

  const { mode, darkTheme, lightTheme } = user.settings;
  const find = (id: ThemeDocument['_id'] | null, isDark: boolean) =>
    id ? ThemeModel.findOne({ _id: id, isDark, ...visibleTo(actor) }) : null;
  const [dark, light] = await Promise.all([find(darkTheme, true), find(lightTheme, false)]);

  return { mode, dark, light };
};

export const updateActiveThemes = async (actor: Actor, input: UpdateActiveThemesInput) => {
  const changes: Record<string, unknown> = {};
  if (input.mode) changes['settings.mode'] = input.mode;

  // A mode only accepts a theme of its own kind.
  const slots = [
    ['darkTheme', true],
    ['lightTheme', false]
  ] as const;
  for (const [slot, isDark] of slots) {
    const id = input[slot];
    if (id === undefined) continue;
    if (id !== null && !(await ThemeModel.exists({ _id: id, isDark, ...visibleTo(actor) }))) {
      throw notFound('Theme not found');
    }
    changes[`settings.${slot}`] = id;
  }

  await UserModel.updateOne({ _id: actor.id }, { $set: changes });
  return getActiveThemes(actor);
};
