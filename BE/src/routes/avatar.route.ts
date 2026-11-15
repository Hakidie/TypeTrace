import { Router } from 'express';
import { buyItem, getCatalog, updateAvatar } from '../controllers/avatar.controller';
import { authGuard, optionalAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { avatarLookSchema, buyItemSchema } from '../validators/avatar.validator';

export const avatarRouter = Router();

/** Every avatar item with how it is unlocked and whether it is owned, the look worn and the coins. A guest gets the items to try on, owning only the free ones (SCRUM-251). */
avatarRouter.get('/catalog', optionalAuth, getCatalog);

avatarRouter.use(authGuard);

/** Puts on a whole look; answers the user, like `/api/auth/me`. */
avatarRouter.put('/', validate({ body: avatarLookSchema }), updateAvatar);
/** Buys a shop item with coins; answers the catalog. */
avatarRouter.post('/buy', validate({ body: buyItemSchema }), buyItem);
