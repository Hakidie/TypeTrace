import { AVATAR_SLOTS } from '../data/avatar-items';
import { AVATAR_SLOT_NAMES, AvatarSlot, itemKey, unlockOf } from '../data/avatar-catalog';
import { UserModel } from '../models/user.model';
import { badRequest, notFound } from '../utils/app-error';
import { AvatarLookInput } from '../validators/avatar.validator';

const findUser = async (userId: string) => {
  const user = await UserModel.findById(userId);
  if (!user) throw notFound('User not found');
  return user;
};

/** Free items are always owned; the others once they are in `ownedItems`. */
const ownsItem = (ownedItems: string[], slot: AvatarSlot, item: string) =>
  unlockOf(slot, item)?.kind === 'free' || ownedItems.includes(itemKey(slot, item));

/**
 * Every item of every slot with how it is unlocked and whether the user owns it, plus the look they wear and their coins.
 * Accounts saved before the avatar fields get the schema defaults (`DEFAULT_AVATAR`, no coins) when they are read.
 */
export const getCatalog = async (userId: string) => {
  const user = await findUser(userId);
  const slots = Object.fromEntries(
    AVATAR_SLOT_NAMES.map((slot) => [
      slot,
      (AVATAR_SLOTS[slot] as readonly string[]).map((id) => ({ id, unlock: unlockOf(slot, id), owned: ownsItem(user.ownedItems, slot, id) }))
    ])
  );
  return { avatar: user.avatar, coins: user.coins, slots };
};

/** Puts on a whole look. Every item must exist in its slot and be owned; nothing is saved otherwise. */
export const updateAvatar = async (userId: string, look: AvatarLookInput) => {
  const user = await findUser(userId);
  for (const slot of AVATAR_SLOT_NAMES) {
    const item = look[slot];
    if (item === null) continue;
    if (!unlockOf(slot, item)) throw badRequest(`Unknown item: ${slot} ${item}`);
    if (!ownsItem(user.ownedItems, slot, item)) throw badRequest(`Item not owned: ${slot} ${item}`);
  }
  user.set('avatar', look);
  return user.save();
};
