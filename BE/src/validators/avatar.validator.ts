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

export type AvatarLookInput = z.infer<typeof avatarLookSchema>;
