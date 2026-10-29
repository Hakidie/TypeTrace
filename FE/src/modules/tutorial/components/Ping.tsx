import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/utils';
import type { PingMove } from '../types/tutorial.types';

/** One frame of Ping's sprite; each move is a strip of 4 of them. */
const FRAME_W = 64;
const FRAME_H = 88;

interface PingProps {
  move: PingMove;
  /** 1 = 64×88, 2 = 128×176. */
  size?: 1 | 2;
  className?: string;
}

/**
 * Ping, the tutorial guide: plays the 4 frames of `move` with CSS `steps(4)` (`ping-play` in index.css; idle and sad
 * slower). It keeps the colors of its sprite, like the avatars, and stands on its first frame for reduced motion.
 */
export const Ping = ({ move, size = 1, className }: PingProps) => (
  <div
    role="img"
    aria-label="Ping"
    className={cn('ping-sprite shrink-0', (move === 'idle' || move === 'sad') && 'ping-sprite-slow', className)}
    style={
      {
        width: `${FRAME_W * size}px`,
        height: `${FRAME_H * size}px`,
        backgroundImage: `url(/mascot/ping-${move}.png)`,
        backgroundSize: `${FRAME_W * 4 * size}px ${FRAME_H * size}px`,
        '--ping-strip': `${FRAME_W * 4 * size}px`,
      } as CSSProperties
    }
  />
);
