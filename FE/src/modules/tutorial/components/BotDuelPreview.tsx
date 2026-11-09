import { PreviewWord } from '@/modules/rain/components/RainPreview';
import { BotSprite } from './BotSprite';

/** Words in the air above the three bots: `left` and `top` in % of the preview. The tall middle bot gets its word above its head. */
const SAMPLE = [
  { word: 'gõ', left: 2, top: 22 },
  { word: 'nhanh', left: 34, top: 2 },
  { word: 'chữ', left: 76, top: 24 },
] as const;

/**
 * How the Bot duel looks (decorative, for the Minigames tile): words falling over the three bots, the hardest in the middle,
 * all standing at the bottom of the tile, like the avatar of the Rain preview.
 */
export const BotDuelPreview = () => (
  <span aria-hidden="true" className="relative block h-full min-h-72 w-full">
    {SAMPLE.map((sample, i) => (
      <PreviewWord key={sample.word} {...sample} index={i} />
    ))}
    <span className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-1">
      <BotSprite level="easy" move="idle" />
      <BotSprite level="hard" move="idle" size={2} />
      <BotSprite level="medium" move="idle" />
    </span>
  </span>
);
