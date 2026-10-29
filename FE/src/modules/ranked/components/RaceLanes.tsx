import { Flag } from 'lucide-react';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { cn } from '@/shared/lib/utils';
import type { PublicMatch } from '../types/ranked.types';

/**
 * One lane per player: the avatar (typing pose) runs from left to right as the words are finished, over a track that
 * fills up to the finish flag, with the words and the speed. The user's lane is marked "You".
 */
export const RaceLanes = ({ match, myId }: { match: PublicMatch; myId?: string }) => (
  <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
    {match.players.map((player) => {
      const share = match.wordCount ? Math.min(1, player.typedCount / match.wordCount) : 0;
      const mine = player.userId === myId;
      return (
        <div
          key={player.userId}
          role="group"
          aria-label={player.displayName}
          className={cn('border bg-card/60 px-3 pt-1 text-primary backdrop-blur-sm', mine && 'border-primary/50')}
        >
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-semibold text-foreground">
              {player.displayName}
              {mine && <span className="ml-2 font-normal text-muted-foreground">You</span>}
            </span>
            <span className="flex shrink-0 gap-3 text-muted-foreground tabular-nums">
              <span>
                {player.typedCount}/{match.wordCount} words
              </span>
              <span className="font-semibold text-primary">{Math.round(player.wpm)} WPM</span>
            </span>
          </div>
          {/* The avatar is 76px wide: the lane leaves room for it at the far end. */}
          <div className="relative h-20">
            <Flag className="absolute bottom-2 right-0 size-5 text-muted-foreground" aria-hidden="true" />
            <div className="absolute bottom-1 transition-[left] duration-300 ease-out" style={{ left: `calc(${share * 100}% - ${share * 76}px)` }}>
              <AvatarSprite look={player.avatar} pose={player.finished ? 'win' : 'typing'} scale={1} label={`${player.displayName}'s avatar`} />
            </div>
          </div>
          <div className="-mx-3 h-1 bg-primary/15">
            <div className="h-full origin-left bg-primary transition-transform duration-300 ease-out" style={{ transform: `scaleX(${share})` }} />
          </div>
        </div>
      );
    })}
  </div>
);
