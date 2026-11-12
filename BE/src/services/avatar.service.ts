import { AVATAR_SLOTS } from '../data/avatar-items';
import { AVATAR_SLOT_NAMES, AvatarSlot, itemKey, OPTIONAL_SLOTS, unlockOf, unlockOfKey } from '../data/avatar-catalog';
import { isProActive, UserDocument, UserModel } from '../models/user.model';
import { badRequest, conflict, notFound } from '../utils/app-error';
import { AvatarLookInput } from '../validators/avatar.validator';

const findUser = async (userId: string) => {
  const user = await UserModel.findById(userId);
  if (!user) throw notFound('User not found');
  return user;
};

type Owner = Pick<UserDocument, 'ownedItems' | 'proUntil'>;

/** Free items are always owned, Pro items while Pro is active; the others once they are in `ownedItems`. */
const ownsItem = (user: Owner, slot: AvatarSlot, item: string) => {
  const kind = unlockOf(slot, item)?.kind;
  return kind === 'free' || (kind === 'pro' && isProActive(user.proUntil)) || user.ownedItems.includes(itemKey(slot, item));
};

/**
 * Takes the Pro items off the worn look when Pro has ended (they are locked then). Run when the learner reads their account
 * or the catalog. ponytail: another player sees them until the learner next opens the app; a cron would close that gap.
 */
export const dropExpiredProItems = async (user: UserDocument) => {
  if (isProActive(user.proUntil)) return;
  let changed = false;
  for (const slot of OPTIONAL_SLOTS) {
    const item = user.avatar[slot];
    if (item && unlockOf(slot, item)?.kind === 'pro') {
      user.set(`avatar.${slot}`, null);
      changed = true;
    }
  }
  if (changed) await user.save();
};

/**
 * Every item of every slot with how it is unlocked and whether the user owns it, plus the look they wear and their coins.
 * Accounts saved before the avatar fields get the schema defaults (`DEFAULT_AVATAR`, no coins) when they are read.
 */
export const getCatalog = async (userId: string) => {
  const user = await findUser(userId);
  await dropExpiredProItems(user);
  const slots = Object.fromEntries(
    AVATAR_SLOT_NAMES.map((slot) => [
      slot,
      (AVATAR_SLOTS[slot] as readonly string[]).map((id) => ({ id, unlock: unlockOf(slot, id), owned: ownsItem(user, slot, id) }))
    ])
  );
  return {
    avatar: user.avatar,
    coins: user.coins,
    pro: { active: isProActive(user.proUntil), until: user.proUntil ?? null },
    slots
  };
};

/**
 * Buys a shop item with coins and answers the catalog. Spending and adding the item are one conditional update, so two
 * buys at once can neither spend below zero nor buy the same item twice.
 */
export const buyItem = async (userId: string, key: string) => {
  const unlock = unlockOfKey(key);
  if (!unlock) throw badRequest(`Unknown item: ${key}`);
  if (unlock.kind !== 'shop') throw badRequest('This item is not sold');
  const bought = await UserModel.updateOne(
    { _id: userId, coins: { $gte: unlock.price }, ownedItems: { $ne: key } },
    { $inc: { coins: -unlock.price }, $push: { ownedItems: key } }
  );
  if (bought.modifiedCount === 0) {
    const user = await findUser(userId);
    if (user.ownedItems.includes(key)) throw conflict('You already own this item');
    throw badRequest('Not enough coins');
  }
  return getCatalog(userId);
};

/** Puts on a whole look. Every item must exist in its slot and be owned; nothing is saved otherwise. */
export const updateAvatar = async (userId: string, look: AvatarLookInput) => {
  const user = await findUser(userId);
  for (const slot of AVATAR_SLOT_NAMES) {
    const item = look[slot];
    if (item === null) continue;
    if (!unlockOf(slot, item)) throw badRequest(`Unknown item: ${slot} ${item}`);
    if (!ownsItem(user, slot, item)) throw badRequest(`Item not owned: ${slot} ${item}`);
  }
  user.set('avatar', look);
  return user.save();
};
