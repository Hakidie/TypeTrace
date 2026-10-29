import { useEffect, type AnimationEvent, type CSSProperties } from 'react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { AVATAR_MANIFEST } from '@/modules/avatar/data/avatar-manifest';
import { preloadAvatar } from '@/modules/avatar/lib/preload';
import type { AvatarLook } from '@/modules/avatar/types/avatar.types';
import { cn } from '@/shared/lib/utils';
import { rainPose } from '../lib/rain-pose';
import type { RainDrop, RainPhase, RainReaction } from '../types/rain.types';

const AVATAR_SCALE = 2;
const AVATAR_PX = AVATAR_MANIFEST.width * AVATAR_SCALE;
/** The avatar stands on a ground strip this high; the words land on the dashed line at the top of its head. */
const GROUND_PX = 8;
const LAND_PX = AVATAR_PX - 16 + GROUND_PX;
const clamp = (x: number) => Math.min(100, Math.max(0, x));

interface RainStageProps {
  drops: RainDrop[];
  avatar: AvatarLook;
  phase: RainPhase;
  /** The word being typed: the avatar slides under it. */
  targetId?: string | null;
  /** A new `key` replays the hop (a word typed) or the shake (a word landed). */
  reaction?: RainReaction | null;
  /** Freezes every falling word and the sky (the game is paused, or the tab is hidden). */
  paused?: boolean;
  /** A falling word reached the ground. */
  onLand: (id: string) => void;
}

const tileLook = (drop: RainDrop, targeted: boolean) => {
  if (drop.state === 'popped') return 'rain-pop border-primary bg-primary/15';
  if (drop.state === 'missed') return 'rain-splat border-primary/40 text-muted-foreground line-through';
  return cn('rain-heat backdrop-blur-sm', targeted ? 'scale-110 border-primary bg-primary/15' : 'border-foreground/15 bg-background/70 text-foreground/85');
};

/**
 * The play field of word rain, in the red glass of the Typing page: thin streaks fall behind the words, the words fall
 * (CSS animation `rain-fall` in index.css; the stage is a size container, so a word falls the height of the stage) to
 * the dashed line over the avatar's head, and a red bar grows at the foot of a word close to landing (`rain-heat`).
 * The word being typed is lifted and outlined in red; a typed word pops with a ring, a missed one is squashed and the
 * ground flashes. The avatar stands on the ground in the pose of the moment (`rainPose`), slides under the word being
 * typed, hops (with its shadow) or shakes. The game rules live outside: this draws what it is given.
 */
export const RainStage = ({ drops, avatar, phase, targetId = null, reaction = null, paused = false, onLand }: RainStageProps) => {
  useEffect(() => preloadAvatar(avatar), [avatar]);

  const target = drops.find((drop) => drop.id === targetId);
  const avatarX = clamp(target?.x ?? 50);

  return (
    <div
      role="group"
      aria-label="Word rain"
      data-testid="rain-stage"
      data-paused={paused}
      className="rain-sky relative isolate h-[60vh] min-h-80 overflow-hidden border border-primary/20 bg-destructive/10 backdrop-blur-md [container-type:size]"
      style={{ '--rain-ground': `${LAND_PX}px` } as CSSProperties}
    >
      <div aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-primary/30" style={{ bottom: LAND_PX }} />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 border-t border-foreground/15 bg-foreground/5" style={{ height: GROUND_PX }} />
      {reaction?.kind === 'shake' && (
        <div key={reaction.key} aria-hidden="true" className="rain-flash pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-primary/25 to-transparent" />
      )}

      {drops.map((drop) => {
        const x = clamp(drop.x);
        const falling = drop.state === 'falling';
        const targeted = drop.id === targetId && falling;
        const onFallEnd = (event: AnimationEvent<HTMLDivElement>) => {
          // Only the fall counts: the heat, the pop and the splat of the word bubble up here too.
          if (event.target === event.currentTarget && event.animationName === 'rain-fall' && falling) onLand(drop.id);
        };
        return (
          // The word keeps falling while it pops, or stays where it landed while it is squashed, so it does not jump back up.
          <div
            key={drop.id}
            data-testid={`slot-${drop.id}`}
            className={cn('absolute top-0', targeted && 'z-10')}
            style={{ left: `${x}%`, transform: `translateX(-${x}%)` }}
          >
            <div data-testid={`fall-${drop.id}`} className="rain-fall" style={{ animationDuration: `${drop.fallMs}ms` }} onAnimationEnd={onFallEnd}>
              <div
                data-testid={`tile-${drop.id}`}
                aria-current={targeted || undefined}
                className={cn(
                  'relative border px-2.5 py-1 font-mono text-lg font-semibold tracking-tight whitespace-nowrap transition-[scale,background-color,border-color] duration-150 sm:text-xl',
                  tileLook(drop, targeted),
                )}
                // The heat runs with the fall; the pop and the splat keep their own length.
                style={falling ? { animationDuration: `${drop.fallMs}ms` } : undefined}
              >
                <span className="text-primary">{drop.text.slice(0, drop.typed)}</span>
                <span>{drop.text.slice(drop.typed)}</span>
              </div>
            </div>
          </div>
        );
      })}

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
          <AvatarSprite look={avatar} pose={rainPose(phase, reaction)} scale={AVATAR_SCALE} eager />
        </div>
      </div>
    </div>
  );
};
