import { useEffect, useState, type AnimationEvent, type CSSProperties } from 'react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { AVATAR_MANIFEST } from '@/modules/avatar/data/avatar-manifest';
import { preloadAvatar } from '@/modules/avatar/lib/preload';
import type { AvatarLook } from '@/modules/avatar/types/avatar.types';
import { cn } from '@/shared/lib/utils';
import { rainPose } from '../lib/rain-pose';
import type { RainDrop, RainPhase, RainReaction } from '../types/rain.types';

/** The avatar stands on a ground strip this high; the words land on the dashed line at the top of its head. */
const GROUND_PX = 8;
/** The avatar is drawn at this scale: half size on a compact stage (the other player's, in a duel). */
const scaleOf = (compact: boolean) => (compact ? 1 : 2);
const avatarPx = (compact: boolean) => AVATAR_MANIFEST.width * scaleOf(compact);
const landPx = (compact: boolean) => avatarPx(compact) - 8 * scaleOf(compact) + GROUND_PX;
const clamp = (x: number) => Math.min(100, Math.max(0, x));

interface RainStageProps {
  drops: RainDrop[];
  avatar: AvatarLook;
  phase: RainPhase;
  /** The word being typed: the avatar slides under it. */
  targetId?: string | null;
  /** The word Ping frames in the tutorial (`data-tutorial="rain-word"` on its slot). */
  markedId?: string | null;
  /** A new `key` replays the hop (a word typed) or the shake (a word landed). */
  reaction?: RainReaction | null;
  /** Freezes every falling word and the sky (the game is paused, or the tab is hidden). */
  paused?: boolean;
  /** A falling word reached the ground (word rain alone; in a duel only the server decides a landing). */
  onLand?: (id: string) => void;
  /**
   * The server clock of a duel: each word is then placed by its age (`bornAt`), so it appears where the server has it,
   * also when its event arrived late or after a reload.
   */
  clockNow?: () => number;
  /** A small stage without the sky, at half the avatar size: the other player's field in a duel. */
  compact?: boolean;
  /** The size of the stage (default: most of the screen height). */
  className?: string;
}

interface WordProps {
  drop: RainDrop;
  targeted: boolean;
  /** Framed by Ping in the tutorial (`data-tutorial="rain-word"`). */
  marked: boolean;
  compact: boolean;
  clockNow?: () => number;
  onLand?: (id: string) => void;
}

/**
 * One word. On the server clock of a duel its age is taken once, when it is first drawn, and given to its animations as a
 * negative delay: the word starts where the server has it. Changing the delay of a running animation would move it.
 */
const Word = ({ drop, targeted, marked, compact, clockNow, onLand }: WordProps) => {
  const [delay] = useState(() => (clockNow && drop.bornAt !== undefined ? `-${Math.max(0, clockNow() - drop.bornAt)}ms` : undefined));
  const x = clamp(drop.x);
  const falling = drop.state === 'falling';
  const onFallEnd = (event: AnimationEvent<HTMLDivElement>) => {
    // Only the fall counts: the heat, the pop and the splat of the word bubble up here too.
    if (event.target === event.currentTarget && event.animationName === 'rain-fall' && falling) onLand?.(drop.id);
  };
  return (
    // The word keeps falling while it pops, or stays where it landed while it is squashed, so it does not jump back up.
    <div data-testid={`slot-${drop.id}`} data-tutorial={marked ? 'rain-word' : undefined} className={cn('absolute top-0', targeted && 'z-10')} style={{ left: `${x}%`, transform: `translateX(-${x}%)` }}>
      <div data-testid={`fall-${drop.id}`} className="rain-fall" style={{ animationDuration: `${drop.fallMs}ms`, animationDelay: delay }} onAnimationEnd={onFallEnd}>
        <div
          data-testid={`tile-${drop.id}`}
          aria-current={targeted || undefined}
          className={cn(
            'relative border font-mono font-semibold tracking-tight whitespace-nowrap transition-[scale,background-color,border-color] duration-150',
            compact ? 'px-1 py-0.5 text-[0.7rem]' : 'px-2.5 py-1 text-lg sm:text-xl',
            tileLook(drop, targeted),
          )}
          // The heat runs with the fall; the pop and the splat keep their own length.
          style={falling ? { animationDuration: `${drop.fallMs}ms`, animationDelay: delay } : undefined}
        >
          <span className="text-primary">{drop.text.slice(0, drop.typed)}</span>
          <span>{drop.text.slice(drop.typed)}</span>
        </div>
      </div>
    </div>
  );
};

const tileLook = (drop: RainDrop, targeted: boolean) => {
  if (drop.state === 'popped') return 'rain-pop border-primary bg-primary/15';
  if (drop.state === 'missed') return 'rain-splat border-primary/40 text-muted-foreground line-through';
  if (targeted) return 'rain-heat backdrop-blur-sm scale-110 border-primary bg-primary/15';
  // A word thrown by the other player in a duel: a dashed red border, so it reads as the dangerous one.
  if (drop.thrown) return 'rain-heat backdrop-blur-sm border-dashed border-primary bg-background/70 text-primary';
  return 'rain-heat backdrop-blur-sm border-foreground/15 bg-background/70 text-foreground/85';
};

/**
 * The play field of word rain, in the red glass of the Typing page: thin streaks fall behind the words, the words fall
 * (CSS animation `rain-fall` in index.css; the stage is a size container, so a word falls the height of the stage) to
 * the dashed line over the avatar's head, and a red bar grows at the foot of a word close to landing (`rain-heat`).
 * The word being typed is lifted and outlined in red; a typed word pops with a ring, a missed one is squashed and the
 * ground flashes. The avatar stands on the ground in the pose of the moment (`rainPose`), slides under the word being
 * typed, hops (with its shadow) or shakes. The game rules live outside: this draws what it is given.
 */
export const RainStage = ({
  drops,
  avatar,
  phase,
  targetId = null,
  markedId = null,
  reaction = null,
  paused = false,
  onLand,
  clockNow,
  compact = false,
  className = 'h-[60vh] min-h-80',
}: RainStageProps) => {
  useEffect(() => preloadAvatar(avatar), [avatar]);
  const target = drops.find((drop) => drop.id === targetId);
  const avatarX = clamp(target?.x ?? 50);
  const LAND_PX = landPx(compact);
  const AVATAR_PX = avatarPx(compact);

  return (
    <div
      role="group"
      aria-label="Word rain"
      data-testid="rain-stage"
      data-paused={paused}
      className={cn('relative isolate overflow-hidden border border-primary/20 bg-destructive/10 backdrop-blur-md [container-type:size]', !compact && 'rain-sky', className)}
      style={{ '--rain-ground': `${LAND_PX}px` } as CSSProperties}
    >
      <div aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-primary/30" style={{ bottom: LAND_PX }} />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 border-t border-foreground/15 bg-foreground/5" style={{ height: GROUND_PX }} />
      {reaction?.kind === 'shake' && (
        <div key={reaction.key} aria-hidden="true" className="rain-flash pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-primary/25 to-transparent" />
      )}

      {drops.map((drop) => (
        <Word key={drop.id} drop={drop} targeted={drop.id === targetId && drop.state === 'falling'} marked={drop.id === markedId} compact={compact} clockNow={clockNow} onLand={onLand} />
      ))}

      <div
        data-testid="avatar-slot"
        className="absolute transition-[left] duration-200 ease-out"
        style={{ bottom: GROUND_PX, left: `calc(${avatarX}% - ${(avatarX / 100) * AVATAR_PX}px)` }}
      >
        <div aria-hidden="true" className="absolute inset-x-0 -bottom-1 flex justify-center">
          <span key={reaction?.key ?? 'still'} className={cn('h-1.5 w-16 bg-foreground/20', reaction?.kind === 'hop' && 'rain-hop-shadow')} />
        </div>
        <div
          key={reaction?.key ?? 'still'}
          data-testid="avatar-motion"
          className={cn('relative', reaction?.kind === 'hop' && 'rain-hop', reaction?.kind === 'shake' && 'rain-shake')}
        >
          <AvatarSprite look={avatar} pose={rainPose(phase, reaction)} scale={scaleOf(compact)} eager />
        </div>
      </div>
    </div>
  );
};
