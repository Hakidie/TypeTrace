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
const clamp = (x: number) => Math.min(100, Math.max(0, x));

interface RainStageProps {
  drops: RainDrop[];
  avatar: AvatarLook;
  phase: RainPhase;
  /** The word being typed: the avatar slides under it. */
  targetId?: string | null;
  /** A new `key` replays the hop (a word typed) or the shake (a word landed). */
  reaction?: RainReaction | null;
  /** Freezes every falling word (the game is paused, or the tab is hidden). */
  paused?: boolean;
  /** A falling word reached the ground. */
  onLand: (id: string) => void;
}

/**
 * The play field of word rain: the words fall (CSS animation, `rain-fall` in index.css; the stage is a size container,
 * so a word falls the height of the stage down to the avatar), the avatar stands at the bottom in the pose of the
 * moment (`rainPose`) and slides under the word being typed. The game rules live outside: this draws what it is given.
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
      className="relative h-[60vh] min-h-80 overflow-hidden border bg-card/40 backdrop-blur-sm [container-type:size]"
      style={{ '--rain-ground': `${AVATAR_PX - 16}px` } as CSSProperties}
    >
      {drops.map((drop) => {
        const x = clamp(drop.x);
        const settled = drop.state !== 'falling';
        const onFallEnd = (event: AnimationEvent<HTMLDivElement>) => {
          // Only the fall counts: other animations (the fade) and those of children bubble up here too.
          if (event.target === event.currentTarget && event.animationName === 'rain-fall' && !settled) onLand(drop.id);
        };
        return (
          // The word keeps falling while it fades (popped) or stays where it landed (missed), so it does not jump back up.
          <div key={drop.id} data-testid={`slot-${drop.id}`} className="absolute top-0" style={{ left: `${x}%`, transform: `translateX(-${x}%)` }}>
            <div data-testid={`fall-${drop.id}`} className="rain-fall" style={{ animationDuration: `${drop.fallMs}ms` }} onAnimationEnd={onFallEnd}>
              <div
                data-testid={`tile-${drop.id}`}
                className={cn(
                  'border bg-card px-2 py-1 font-mono text-lg whitespace-nowrap',
                  drop.id === targetId && !settled && 'border-primary',
                  settled && 'rain-gone',
                  drop.state === 'missed' && 'border-destructive text-destructive',
                )}
              >
                <span className="text-primary">{drop.text.slice(0, drop.typed)}</span>
                <span className="text-foreground">{drop.text.slice(drop.typed)}</span>
              </div>
            </div>
          </div>
        );
      })}
      <div
        data-testid="avatar-slot"
        className="absolute bottom-0 transition-[left] duration-200 ease-out"
        style={{ left: `calc(${avatarX}% - ${(avatarX / 100) * AVATAR_PX}px)` }}
      >
        <div
          key={reaction?.key ?? 'still'}
          data-testid="avatar-motion"
          className={cn(reaction?.kind === 'hop' && 'rain-hop', reaction?.kind === 'shake' && 'rain-shake')}
        >
          <AvatarSprite look={avatar} pose={rainPose(phase, reaction)} scale={AVATAR_SCALE} eager />
        </div>
      </div>
    </div>
  );
};
