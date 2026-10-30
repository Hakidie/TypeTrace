import { ArrowLeft, CalendarDays, CloudRain, type LucideIcon } from 'lucide-react';
import { DailyMode } from '@/modules/daily/components/DailyMode';
import { RainMode } from '@/modules/rain/components/RainMode';
import { hoverFrame, PanelArt, titleClass } from '@/modules/ranked/components/RankLobby';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export type MinigameId = 'rain' | 'daily';

const minigames: { id: MinigameId; title: string; description: string; icon: LucideIcon }[] = [
  { id: 'rain', title: 'Rain', description: 'Type the falling words before they land. A round lasts a minute.', icon: CloudRain },
  { id: 'daily', title: 'Daily', description: 'One passage for everyone each day. Beat your last try and climb the board.', icon: CalendarDays },
];

/**
 * The Minigames tab of the Typing page (`?mode=minigames`): a card for each minigame. The picked one lives in the URL
 * (`&game=rain|daily`) and opens in place of the cards, with a button under it, in the center, back to them.
 */
export const MinigamesMode = ({ game, onSelect, onBack }: { game?: MinigameId; onSelect: (id: MinigameId) => void; onBack: () => void }) => {
  if (game) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        {/* The game sits in the middle of the free height, between the tabs and the back button. */}
        <div className="flex flex-1 flex-col justify-center">{game === 'rain' ? <RainMode /> : <DailyMode />}</div>
        <div className="mt-auto flex justify-center pb-4">
          <Button variant="ghost" className="h-auto gap-2 px-3 py-1.5 text-base text-muted-foreground" onClick={onBack}>
            <ArrowLeft className="size-4" /> All minigames
          </Button>
        </div>
      </div>
    );
  }
  // The lobby of the Rank tab again: a framed panel for each game with a big icon, its description that opens the card while hovered; a click on it opens the game.
  return (
    <div className="mx-auto mt-20 grid w-full max-w-7xl items-start gap-x-12 gap-y-6 md:grid-cols-2">
      {minigames.map(({ id, title, description, icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={cn(hoverFrame, 'group cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
        >
          <Panel title={title} bare centerTitle titleClassName={titleClass} fill>
            <PanelArt icon={icon} />
            {/* The card opens down to show the description while it is hovered or has the focus (always open on touch screens, which cannot hover). */}
            <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr] pointer-coarse:grid-rows-[1fr]">
              <div className="overflow-hidden">
                <p className="px-4 pb-4 text-center text-base text-muted-foreground">{description}</p>
              </div>
            </div>
          </Panel>
        </button>
      ))}
    </div>
  );
};
