import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import type { PublicMatch } from '../types/ranked.types';

/**
 * One lane per player: the avatar (typing pose) runs from left to right as the words are finished, with the words and
 * the speed. The user's lane is marked "You".
 */
export const RaceLanes = ({ match, myId }: { match: PublicMatch; myId?: string }) => (
  <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
    {match.players.map((player) => {
      const share = match.wordCount ? Math.min(1, player.typedCount / match.wordCount) : 0;
      return (
        <div key={player.userId} role="group" aria-label={player.displayName} className="bg-primary/10 px-3 py-1 text-primary">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-semibold">
              {player.displayName}
              {player.userId === myId && <span className="ml-2 text-muted-foreground">You</span>}
            </span>
            <span className="flex shrink-0 gap-3 text-muted-foreground">
              <span>
                {player.typedCount}/{match.wordCount} words
              </span>
              <span>{Math.round(player.wpm)} WPM</span>
            </span>
          </div>
          {/* The avatar is 76px wide: the lane leaves room for it at the far end. */}
          <div className="relative h-20">
            <div className="absolute bottom-0 transition-[left] duration-300" style={{ left: `calc(${share * 100}% - ${share * 76}px)` }}>
              <AvatarSprite look={player.avatar} pose={player.finished ? 'win' : 'typing'} scale={1} label={`${player.displayName}'s avatar`} />
            </div>
          </div>
        </div>
      );
    })}
  </div>
);
