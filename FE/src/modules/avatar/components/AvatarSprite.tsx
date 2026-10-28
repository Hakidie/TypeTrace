import { cn } from '@/shared/lib/utils';
import { AVATAR_MANIFEST } from '../data/avatar-manifest';
import { layerFiles } from '../lib/layers';
import type { AvatarLook, AvatarPose } from '../types/avatar.types';

const { width: FRAME_W, height: FRAME_H } = AVATAR_MANIFEST;
/** The head in the 76x76 frame (the body frame starts 6px right, 12px down): a 40px square around the face. */
const HEAD = { x: 18, y: 8, size: 40 };

interface AvatarSpriteProps {
  look: AvatarLook;
  pose?: AvatarPose;
  /** How many screen pixels one sprite pixel takes. */
  scale?: number;
  /** `head`: only the face and the hair, for small round spots like the account menu. */
  crop?: 'full' | 'head';
  /** Read by screen readers (default "Avatar"). */
  label?: string;
  className?: string;
}

/**
 * A pixel avatar: one image per layer (`layerFiles`), stacked in a frame of a fixed size, so the layout does not move
 * while the images load or when one is missing. The avatar art keeps its own colors (an exception to the theme tokens).
 */
export const AvatarSprite = ({ look, pose = 'idle', scale = 2, crop = 'full', label = 'Avatar', className }: AvatarSpriteProps) => {
  const head = crop === 'head';
  const size = head ? { width: HEAD.size * scale, height: HEAD.size * scale } : { width: FRAME_W * scale, height: FRAME_H * scale };
  return (
    <div role="img" aria-label={label} className={cn('relative shrink-0 overflow-hidden', className)} style={size}>
      <div
        className="absolute"
        style={{ width: FRAME_W * scale, height: FRAME_H * scale, left: head ? -HEAD.x * scale : 0, top: head ? -HEAD.y * scale : 0 }}
      >
        {layerFiles(look, pose).map((file) => (
          <img
            key={file}
            src={`/avatar/${file}`}
            alt=""
            // The wardrobe shows a hundred avatars per tab: only the ones scrolled into view are fetched.
            loading="lazy"
            draggable={false}
            className="absolute inset-0 size-full select-none"
            style={{ imageRendering: 'pixelated' }}
          />
        ))}
      </div>
    </div>
  );
};
