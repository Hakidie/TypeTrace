import { Router } from 'express';
import { getCatalog, updateAvatar } from '../controllers/avatar.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { avatarLookSchema } from '../validators/avatar.validator';

export const avatarRouter = Router();

avatarRouter.use(authGuard);

/** Every avatar item with how it is unlocked and whether it is owned, the look worn and the coins. */
avatarRouter.get('/catalog', getCatalog);
/** Puts on a whole look; answers the user, like `/api/auth/me`. */
avatarRouter.put('/', validate({ body: avatarLookSchema }), updateAvatar);
