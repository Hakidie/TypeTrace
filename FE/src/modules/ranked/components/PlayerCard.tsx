import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import type { AvatarPose } from '@/modules/avatar/types/avatar.types';
import { cn } from '@/shared/lib/utils';
import type { MatchPlayerView } from '../types/ranked.types';

interface PlayerCardProps {
  /** Empty: the seat waits for an opponent. */
  player?: MatchPlayerView;
  isMe?: boolean;
  pose?: AvatarPose;
  /** Under the name: e.g. Ready / Not ready, or the score. */
  children?: React.ReactNode;
  className?: string;
}

/** One seat of a room: the avatar, the name ("You" for the user) and a line under it. */
export const PlayerCard = ({ player, isMe = false, pose = 'idle', children, className }: PlayerCardProps) => (
  <div className={cn('flex flex-col items-center gap-2 bg-primary/10 p-4 text-center text-primary', className)}>
    {player ? (
      <>
        <AvatarSprite look={player.avatar} pose={pose} scale={2} label={`${player.displayName}'s avatar`} />
        <p className="text-lg font-semibold">
          {player.displayName}
          {isMe && <span className="ml-2 text-sm text-muted-foreground">(you)</span>}
        </p>
        {children}
      </>
    ) : (
      <div className="flex min-h-48 items-center justify-center text-muted-foreground">Waiting for an opponent…</div>
    )}
  </div>
);
