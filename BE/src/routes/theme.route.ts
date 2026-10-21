import { Router } from 'express';
import {
  createTheme,
  deleteTheme,
  getActiveThemes,
  listThemes,
  updateActiveThemes,
  updateTheme
} from '../controllers/theme.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParamsSchema } from '../validators/common.validator';
import {
  createThemeSchema,
  listThemesQuerySchema,
  updateActiveThemesSchema,
  updateThemeSchema
} from '../validators/theme.validator';

export const themeRouter = Router();

themeRouter.use(authGuard);

// `/active` comes before `/:id` so it is not read as an id.
themeRouter.get('/active', getActiveThemes);
themeRouter.patch('/active', validate({ body: updateActiveThemesSchema }), updateActiveThemes);

themeRouter.get('/', validate({ query: listThemesQuerySchema }), listThemes);
themeRouter.post('/', validate({ body: createThemeSchema }), createTheme);
themeRouter.patch('/:id', validate({ params: idParamsSchema, body: updateThemeSchema }), updateTheme);
themeRouter.delete('/:id', validate({ params: idParamsSchema }), deleteTheme);
