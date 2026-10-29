// What every avatar item costs (ranked duel design, section 7): the starter items are free, the others are sold for
// coins (from phase 6) or are season tier rewards. The items themselves come from the generated `avatar-items.ts`.
import { AVATAR_SLOTS } from './avatar-items';

export const AVATAR_SLOT_NAMES = ['skin', 'face', 'hair', 'top', 'bottom', 'shoes', 'headwear', 'accessory', 'back', 'effect'] as const;
export type AvatarSlot = (typeof AVATAR_SLOT_NAMES)[number];

/** These slots may stay empty (`null`); the others always hold an item. */
export const OPTIONAL_SLOTS = ['headwear', 'accessory', 'back', 'effect'] as const satisfies readonly AvatarSlot[];
type OptionalSlot = (typeof OPTIONAL_SLOTS)[number];
type RequiredSlot = Exclude<AvatarSlot, OptionalSlot>;

export type AvatarLook = Record<RequiredSlot, string> & Partial<Record<OptionalSlot, string | null>>;

/** Every new account wears this (the `rookie` preset); also used for accounts saved before the avatar fields. */
export const DEFAULT_AVATAR = {
  skin: 'peach',
  face: 'classic',
  hair: 'short-brown',
  top: 'red',
  bottom: 'navy',
  shoes: 'sneakers-brown'
} as const satisfies AvatarLook;

/** The tiers that give an item, lowest first. */
export const REWARD_TIERS = ['gold', 'platinum', 'diamond', 'legend'] as const;
export type Tier = (typeof REWARD_TIERS)[number];
export type Unlock = { kind: 'free' } | { kind: 'shop'; price: number } | { kind: 'tier'; tier: Tier } | { kind: 'season' };

/** The items only a season tier gives (never sold). */
export const TIER_REWARDS: Record<string, Tier> = {
  'headwear:halo': 'legend',
  'headwear:crown': 'diamond',
  'back:angel-wings': 'platinum',
  'effect:stars': 'gold'
};

/**
 * The item of each season for Gold and up (`Season.rewardItem`), in turn: season 1 gets the first, and so on. Never sold,
 * so a season item shows that its owner reached Gold in that season.
 */
export const SEASON_ITEMS = ['effect:flames', 'headwear:tiara', 'back:fairy-wings', 'accessory:medal-gold', 'effect:snow'];

/** What an item already owned is worth when a reward gives it again: its price, or this for an item not sold. */
export const OWNED_REWARD_COINS = 100;

/** The price of a shop item, by slot (dresses cost more than the other tops). */
const SLOT_PRICES: Record<AvatarSlot, number> = {
  skin: 0,
  face: 0,
  hair: 100,
  top: 120,
  bottom: 80,
  shoes: 80,
  headwear: 100,
  accessory: 80,
  back: 250,
  effect: 200
};
const DRESS_PRICE = 150;

/**
 * The starter items: every skin and face, short and long hair, the hoodies (a top named by its color only), the plain
 * trousers and tights, the SpriteCook sneakers.
 */
const isFree = (slot: AvatarSlot, item: string) => {
  switch (slot) {
    case 'skin':
    case 'face':
      return true;
    case 'hair':
      return item.startsWith('short-') || item.startsWith('long-');
    case 'top':
      return !item.includes('-');
    case 'bottom':
      return !item.includes('-') || item.startsWith('tights-');
    case 'shoes':
      return item === 'sneakers-brown';
    default:
      return false;
  }
};

/** How an item is unlocked, `undefined` when the slot has no such item. */
export const unlockOf = (slot: AvatarSlot, item: string): Unlock | undefined => {
  if (!(AVATAR_SLOTS[slot] as readonly string[]).includes(item)) return undefined;
  if (isFree(slot, item)) return { kind: 'free' };
  const tier = TIER_REWARDS[itemKey(slot, item)];
  if (tier) return { kind: 'tier', tier };
  if (SEASON_ITEMS.includes(itemKey(slot, item))) return { kind: 'season' };
  return { kind: 'shop', price: slot === 'top' && item.startsWith('dress-') ? DRESS_PRICE : SLOT_PRICES[slot] };
};

/** How an owned item is saved in `User.ownedItems`. */
export const itemKey = (slot: AvatarSlot, item: string) => `${slot}:${item}`;

/** The unlock of an item key (`slot:item`), `undefined` for an unknown slot or item. */
export const unlockOfKey = (key: string) => {
  const [slot, item] = key.split(':');
  return (AVATAR_SLOT_NAMES as readonly string[]).includes(slot) && item ? unlockOf(slot as AvatarSlot, item) : undefined;
};
