import { Router } from 'express';
import {
  createPassage,
  deletePassage,
  getPassage,
  listPassages,
  setPassageStatus,
  updatePassage
} from '../controllers/admin-passage.controller';
import { bulkDeleteUsers, deleteUser, getStats, getUser, listUsers, updateUser } from '../controllers/admin.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createPassageSchema,
  listPassagesQuerySchema,
  setPassageStatusSchema,
  updatePassageSchema
} from '../validators/admin-passage.validator';
import { adminUpdateUserSchema, listUsersQuerySchema } from '../validators/admin-user.validator';
import { bulkIdsSchema, idParamsSchema } from '../validators/common.validator';

export const adminRouter = Router();

// Admin API: signed-in accounts with the `admin` role only (others get 403).
adminRouter.use(authGuard, requireRole('admin'));

adminRouter.get('/stats', getStats);
adminRouter.get('/users', validate({ query: listUsersQuerySchema }), listUsers);
adminRouter.post('/users/bulk-delete', validate({ body: bulkIdsSchema }), bulkDeleteUsers);
adminRouter.get('/users/:id', validate({ params: idParamsSchema }), getUser);
adminRouter.patch('/users/:id', validate({ params: idParamsSchema, body: adminUpdateUserSchema }), updateUser);
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
