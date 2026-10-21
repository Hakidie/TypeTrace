import { Router } from 'express';
import {
  createPassage,
  deletePassage,
  getPassage,
  listPassages,
  setPassageStatus,
  updatePassage
} from '../controllers/admin-passage.controller';
import { createTheme, deleteTheme, listThemes, updateTheme } from '../controllers/admin-theme.controller';
import { bulkDeleteUsers, deleteUser, getStats, getUser, listUsers, setUserStatus, updateUser } from '../controllers/admin.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createPassageSchema,
  listPassagesQuerySchema,
  setPassageStatusSchema,
  updatePassageSchema
} from '../validators/admin-passage.validator';
import { createAdminThemeSchema, listAdminThemesQuerySchema, updateAdminThemeSchema } from '../validators/admin-theme.validator';
import { adminUpdateUserSchema, listUsersQuerySchema, setUserStatusSchema } from '../validators/admin-user.validator';
import { bulkIdsSchema, idParamsSchema } from '../validators/common.validator';

export const adminRouter = Router();

// Admin API: signed-in accounts with the `admin` role only (others get 403).
adminRouter.use(authGuard, requireRole('admin'));

adminRouter.get('/stats', getStats);
adminRouter.get('/users', validate({ query: listUsersQuerySchema }), listUsers);
adminRouter.post('/users/bulk-delete', validate({ body: bulkIdsSchema }), bulkDeleteUsers);
adminRouter.get('/users/:id', validate({ params: idParamsSchema }), getUser);
adminRouter.patch('/users/:id', validate({ params: idParamsSchema, body: adminUpdateUserSchema }), updateUser);
adminRouter.patch('/users/:id/status', validate({ params: idParamsSchema, body: setUserStatusSchema }), setUserStatus);
adminRouter.delete('/users/:id', validate({ params: idParamsSchema }), deleteUser);

adminRouter.get('/passages', validate({ query: listPassagesQuerySchema }), listPassages);
adminRouter.post('/passages', validate({ body: createPassageSchema }), createPassage);
adminRouter.get('/passages/:id', validate({ params: idParamsSchema }), getPassage);
adminRouter.patch('/passages/:id', validate({ params: idParamsSchema, body: updatePassageSchema }), updatePassage);
adminRouter.patch(
  '/passages/:id/status',
  validate({ params: idParamsSchema, body: setPassageStatusSchema }),
  setPassageStatus
);
adminRouter.delete('/passages/:id', validate({ params: idParamsSchema }), deletePassage);

adminRouter.get('/themes', validate({ query: listAdminThemesQuerySchema }), listThemes);
adminRouter.post('/themes', validate({ body: createAdminThemeSchema }), createTheme);
adminRouter.patch('/themes/:id', validate({ params: idParamsSchema, body: updateAdminThemeSchema }), updateTheme);
adminRouter.delete('/themes/:id', validate({ params: idParamsSchema }), deleteTheme);
