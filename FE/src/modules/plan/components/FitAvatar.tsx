import { useEffect, useRef, useState } from 'react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { AVATAR_MANIFEST } from '@/modules/avatar/data/avatar-manifest';
import type { AvatarLook } from '@/modules/avatar/types/avatar.types';

const FRAME = AVATAR_MANIFEST.height;

/** The avatar never takes more than this share of the card's width. */
const MAX_WIDTH_SHARE = 0.3;

/**
 * A pixel avatar as tall as the column it stands in (the column's height comes from its neighbour) and never wider than
 * 30% of its card: the scale follows both, so it grows and shrinks with the card (`imageRendering: pixelated` keeps the edges sharp).
 */
export const FitAvatar = ({ look, label }: { look: AvatarLook; label: string }) => {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(3);
  useEffect(() => {
    const node = box.current;
    const card = node?.closest('fieldset');
    if (!node || !card || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const byHeight = node.clientHeight / FRAME;
      const byWidth = (card.clientWidth * MAX_WIDTH_SHARE) / AVATAR_MANIFEST.width;
      setScale(Math.max(0.5, Math.round(Math.min(byHeight, byWidth) * 20) / 20));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    observer.observe(card);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} className="relative self-stretch" style={{ width: AVATAR_MANIFEST.width * scale }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <AvatarSprite look={look} scale={scale} label={label} />
      </div>
    </div>
  );
};
