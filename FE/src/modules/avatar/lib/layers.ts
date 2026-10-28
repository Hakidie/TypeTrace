import { AVATAR_MANIFEST } from '../data/avatar-manifest';
import type { AvatarLook, AvatarPose } from '../types/avatar.types';

const hairWithBack: readonly string[] = AVATAR_MANIFEST.hairWithBack;

/**
 * The images of one avatar in one pose, bottom layer first, as paths under `/avatar/` (FE/public/avatar). The same rule
 * as `layerFiles` in minigame-sprites/build-layers.mjs: the arms are raised only to win, long hair has a back layer,
 * the pose props (`fx`) are drawn on top except when idle.
 */
export const layerFiles = (look: AvatarLook, pose: AvatarPose): string[] => {
  const files: Record<(typeof AVATAR_MANIFEST.layerOrder)[number], string | null> = {
    back: look.back ? `back/${look.back}.png` : null,
    hairBack: hairWithBack.includes(look.hair) ? `hair-back/${look.hair}.png` : null,
    bottom: `bottom/${look.bottom}.png`,
    shoes: `shoes/${look.shoes || 'sneakers-brown'}.png`,
    top: `top/${look.top}-${pose === 'win' ? 'up' : 'down'}.png`,
    body: `body/${look.skin}${look.face === 'cute' ? '-cute' : ''}-${pose}.png`,
    accessory: look.accessory ? `accessory/${look.accessory}.png` : null,
    hair: `hair/${look.hair}.png`,
    headwear: look.headwear ? `headwear/${look.headwear}.png` : null,
    effect: look.effect ? `effect/${look.effect}.png` : null,
    fx: pose === 'idle' ? null : `fx/${pose}.png`,
  };
  return AVATAR_MANIFEST.layerOrder.map((layer) => files[layer]).filter((file): file is string => file !== null);
};
