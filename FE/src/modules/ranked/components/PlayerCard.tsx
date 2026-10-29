import type { CSSProperties } from 'react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import type { AvatarPose } from '@/modules/avatar/types/avatar.types';
import { cn } from '@/shared/lib/utils';
import type { MatchPlayerView } from '../types/ranked.types';
import { LoadingRing } from './LoadingRing';

interface PlayerCardProps {
  /** Empty: the seat waits for an opponent. */
  player?: MatchPlayerView;
  isMe?: boolean;
  pose?: AvatarPose;
  /** Outlined in the accent color: the player is ready, or won. */
  highlight?: boolean;
  /** Under the name: e.g. Ready / Not ready, or the score. */
  children?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** One seat of a room (it fills the height its grid row gives it, so two seats side by side are equally high): the avatar on a floor line, the name ("you" for the user) and a line under it. */
export const PlayerCard = ({ player, isMe = false, pose = 'idle', highlight = false, children, className, style }: PlayerCardProps) => (
  <div
    className={cn(
      'flex flex-col items-center gap-2 border bg-card/60 p-4 text-center text-primary backdrop-blur-sm transition-[outline-color] duration-300',
      'outline-2 -outline-offset-2',
      highlight ? 'outline outline-primary' : 'outline-transparent',
      className,
    )}
    style={style}
  >
    {player ? (
      <>
        <div className="w-full border-b border-primary/30">
          <AvatarSprite look={player.avatar} pose={pose} scale={2} label={`${player.displayName}'s avatar`} className="mx-auto" />
        </div>
        <p className="text-lg font-semibold text-foreground">
          {player.displayName}
          {isMe && <span className="ml-2 text-sm font-normal text-muted-foreground">(you)</span>}
        </p>
        {children}
      </>
    ) : (
      <LoadingRing label="Waiting for an opponent…" className="min-h-48 flex-1 justify-center" />
    )}
  </div>
);
