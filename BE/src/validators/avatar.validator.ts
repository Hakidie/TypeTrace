import { z } from 'zod';

const item = z.string().trim().min(1).max(60);

/** A whole look: the six required slots, the four optional ones may be empty (`null`). Unknown keys are dropped. */
export const avatarLookSchema = z.object({
  skin: item,
  face: item,
  hair: item,
  top: item,
  bottom: item,
  shoes: item,
  headwear: item.nullable().default(null),
  accessory: item.nullable().default(null),
  back: item.nullable().default(null),
  effect: item.nullable().default(null)
});

/** `{ item: 'slot:item' }`, the way `User.ownedItems` names an item. */
export const buyItemSchema = z.object({
  item: z.string().trim().regex(/^[a-z]+:[a-z0-9-]{1,60}$/, 'item must look like slot:item')
});

export type AvatarLookInput = z.infer<typeof avatarLookSchema>;
export type BuyItemInput = z.infer<typeof buyItemSchema>;
