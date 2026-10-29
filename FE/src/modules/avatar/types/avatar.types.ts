/** The poses of every avatar (the sprite sheets have one file per pose for the body, the arms and the props). */
export type AvatarPose = 'idle' | 'typing' | 'win' | 'lose';

export type AvatarSlot = 'skin' | 'face' | 'hair' | 'top' | 'bottom' | 'shoes' | 'headwear' | 'accessory' | 'back' | 'effect';

/** Mirrors `AvatarLook` of the backend (`BE/src/data/avatar-catalog.ts`): `null` = an empty optional slot. */
export interface AvatarLook {
  skin: string;
  face: string;
  hair: string;
  top: string;
  bottom: string;
  shoes: string;
  headwear?: string | null;
  accessory?: string | null;
  back?: string | null;
  effect?: string | null;
}

/** What a new account wears (`DEFAULT_AVATAR` of the backend), also shown while the user is loading. */
export const DEFAULT_AVATAR: AvatarLook = {
  skin: 'peach',
  face: 'classic',
  hair: 'short-brown',
  top: 'red',
  bottom: 'navy',
  shoes: 'sneakers-brown',
};

export type AvatarTier = 'gold' | 'platinum' | 'diamond' | 'legend';
/** How an item is unlocked: a starter item, sold for coins, a season tier reward, or the item of a season (Gold and up). */
export type AvatarUnlock = { kind: 'free' } | { kind: 'shop'; price: number } | { kind: 'tier'; tier: AvatarTier } | { kind: 'season' };

export interface AvatarItem {
  id: string;
  unlock: AvatarUnlock;
  owned: boolean;
}

/** `GET /api/avatar/catalog`. */
export interface AvatarCatalog {
  avatar: AvatarLook;
  coins: number;
  slots: Record<AvatarSlot, AvatarItem[]>;
}
