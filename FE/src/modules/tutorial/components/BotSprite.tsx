import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/utils';
import { BOT_LEVELS, type BotLevel } from '../lib/practice-duel';

export type BotMove = 'idle' | 'typing' | 'win' | 'lose';

/** One frame of a bot's sprite, like Ping's; each move is a strip of 4 of them. */
const FRAME_W = 64;
const FRAME_H = 88;

interface BotSpriteProps {
  level: BotLevel;
  move: BotMove;
  /** 1 = 64×88, 2 = 128×176. */
  size?: 1 | 2;
  className?: string;
}

/**
 * The bot of a Bot duel level (Bông, Nhịp, Dạ): plays the 4 frames of `move` from `/bots/<bot>-<move>.png` with the
 * same CSS as Ping (`ping-sprite`). It keeps the colors of its sprite and stands on its first frame for reduced motion.
 */
export const BotSprite = ({ level, move, size = 1, className }: BotSpriteProps) => {
  const { bot, name } = BOT_LEVELS[level];
  return (
    <div
      role="img"
      aria-label={name}
      className={cn('ping-sprite shrink-0', (move === 'idle' || move === 'lose') && 'ping-sprite-slow', className)}
      style={
        {
          width: `${FRAME_W * size}px`,
          height: `${FRAME_H * size}px`,
          backgroundImage: `url(/bots/${bot}-${move}.png)`,
          backgroundSize: `${FRAME_W * 4 * size}px ${FRAME_H * size}px`,
          '--ping-strip': `${FRAME_W * 4 * size}px`,
        } as CSSProperties
      }
    />
  );
};
