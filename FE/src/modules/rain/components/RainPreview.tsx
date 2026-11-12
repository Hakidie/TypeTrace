import type { CSSProperties } from 'react';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';

/** A few words in the air: `left` in % of the width, `top` in % of the height. The preview fills the height of the tile and the avatar takes the middle, so the words stay out of its way. */
const SAMPLE = [
  { word: 'mưa', left: 8, top: 4 },
  { word: 'nhanh', left: 60, top: 2 },
  { word: 'gõ', left: 4, top: 40 },
  { word: 'chữ', left: 72, top: 36 },
] as const;

/** One falling word of a preview: its tile with a streak above it, `left` and `top` in % of the preview; it sinks a little when the tile is hovered. */
export const PreviewWord = ({ word, left, top, index }: { word: string; left: number; top: number; index: number }) => (
  <span
    className="absolute flex flex-col items-center transition-transform duration-500 group-hover:translate-y-3"
    style={{ left: `${left}%`, top: `${top}%`, transitionDelay: `${index * 60}ms` } as CSSProperties}
  >
    {/* the streak the word leaves behind it */}
    <span className="h-5 w-px bg-gradient-to-b from-transparent to-primary/60" />
    <span className="border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-lg font-semibold tracking-tight whitespace-nowrap text-foreground">
      {word}
    </span>
  </span>
);

/**
 * How word rain looks, drawn with the pieces of the game (decorative, for the Minigames tile): words in their tiles falling
 * towards the player's avatar, which stands at the bottom. The preview fills the height of the tile and the avatar takes
 * the middle, so the words stay out of its way.
 */
export const RainPreview = () => {
  const { data: me } = useCurrentUser();
  return (
    <span aria-hidden="true" className="relative block h-full min-h-48 w-full">
      {SAMPLE.map((sample, i) => (
        <PreviewWord key={sample.word} {...sample} index={i} />
      ))}
      <span className="absolute inset-x-0 bottom-0 flex justify-center">
        <AvatarSprite look={me?.avatar ?? DEFAULT_AVATAR} scale={2} label="" />
      </span>
    </span>
  );
};
