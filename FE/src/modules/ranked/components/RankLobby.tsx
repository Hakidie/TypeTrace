import { useState, type FormEvent } from 'react';
import { CloudRain, DoorOpen, Gamepad2, Swords, Trophy, type LucideIcon } from 'lucide-react';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useCreateMatch, useJoinMatch } from '../hooks/use-match';
import { useRankedMe } from '../hooks/use-ranked';
import { LeaderboardLink } from './LeaderboardLink';
import { SeasonPanel } from './SeasonPanel';
import type { MatchKind } from '../types/ranked.types';

// The size of the profile page's section titles (`sectionTitleClass`), in the red of the season above.
export const titleClass = 'text-[1.5rem] text-primary';

const ROOM_CODE_LENGTH = 6;

const KINDS = [
  { value: 'race', label: 'Race', icon: Swords },
  { value: 'rain', label: 'Rain', icon: CloudRain },
];
/** The kind chosen last in this tab (sessionStorage; storage can be blocked, then it is Race). */
const KIND_KEY = 'ranked.kind';
const lastKind = (): MatchKind => {
  try {
    return sessionStorage.getItem(KIND_KEY) === 'rain' ? 'rain' : 'race';
  } catch {
    return 'race';
  }
};
const rememberKind = (kind: MatchKind) => {
  try {
    sessionStorage.setItem(KIND_KEY, kind);
  } catch {
    // not remembered
  }
};
/** What a room of each kind is, under the title of the create panel. */
const KIND_TIPS: Record<MatchKind, string> = {
  race: 'Open a room and share its code. You both type the same English passage.',
  rain: 'Open a room and share its code. Words rain on both of you; every word you type falls on your friend. Three misses and you are out.',
};

/** What each mode is, on its card in the Mode modal. */
const MODE_TIPS: Record<MatchKind, string> = {
  race: 'Type the same English passage as your friend. The faster and more accurate one wins.',
  rain: 'Words rain on both of you; every word you type falls on your friend. Three misses and you are out.',
};

// The frame of the other panels (the normal border color, the thin red while hovered) around a bare panel, which has no padding of its own: it is as wide as the season bar above it.
export const hoverFrame = 'flex flex-col border border-border p-3 transition-colors hover:border-destructive/40';

/**
 * A big icon, in the red of the panel titles, that fills the free space of a lobby panel above its controls. 0.5rem on top:
 * the header of a bare panel keeps 1rem under the title, so the icon has 1.5rem above and below.
 */
export const PanelArt = ({ icon: Icon }: { icon: LucideIcon }) => (
  <div className="flex flex-1 items-center justify-center pb-6 pt-2">
    <Icon className="size-24 text-primary" strokeWidth={1.25} aria-hidden="true" />
  </div>
);

/** An icon button (beside the leaderboard button) that opens a modal with a card for each mode of play; picking one chooses it. */
const ModeButton = ({ kind, onChoose, hoverOnly = false }: { kind: MatchKind; onChoose: (kind: MatchKind) => void; hoverOnly?: boolean }) => {
  const [open, setOpen] = useState(false);
  const current = KINDS.find((item) => item.value === kind);
  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Mode"
              onClick={() => setOpen(true)}
              className={cn(
                'flex size-[2.3rem] shrink-0 items-center justify-center text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                // Like the leaderboard button: shown while the season bar is hovered or holds the focus (always on touch screens).
                hoverOnly && 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100',
              )}
            >
              <Gamepad2 className="size-6" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Mode: {current?.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {/* MODAL Mode: a card for each mode of play. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className={titleClass}>Mode</DialogTitle>
            <DialogDescription>Pick the kind of duel. Each mode has its own rating and leaderboard.</DialogDescription>
          </DialogHeader>
          {/* The cards of the Minigames tab: a framed panel with a big icon, the description opens while hovered. */}
          <div role="radiogroup" aria-label="Kind of match" className="grid items-start gap-6 sm:grid-cols-2">
            {KINDS.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => {
                  onChoose(value as MatchKind);
                  setOpen(false);
                }}
                className={cn(
                  hoverFrame,
                  'group cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  kind === value && 'border-destructive/60',
                )}
              >
                <Panel title={label} bare centerTitle titleClassName={titleClass} fill>
                  <PanelArt icon={icon} />
                  <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr] pointer-coarse:grid-rows-[1fr]">
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-center text-base text-muted-foreground">{MODE_TIPS[value as MatchKind]}</p>
                    </div>
                  </div>
                </Panel>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/** No room yet: the kind of match (Race or Rain), the own season rating of that kind, then create a room of that kind (the code is shared with a friend) or join one with its code. */
export const RankLobby = ({ onEnter }: { onEnter: (code: string) => void }) => {
  const createMatch = useCreateMatch();
  const joinMatch = useJoinMatch();
  const [kind, setKind] = useState<MatchKind>(lastKind);
  const ranking = useRankedMe(kind);
  const [code, setCode] = useState('');
  const pending = createMatch.isPending || joinMatch.isPending;

  const chooseKind = (value: string) => {
    setKind(value as MatchKind);
    rememberKind(value as MatchKind);
  };

  const joinWith = (typed: string) => {
    if (typed.length === ROOM_CODE_LENGTH && !pending) joinMatch.mutate(typed, { onSuccess: (match) => onEnter(match.code) });
  };

  // The room is joined as soon as the code is complete (typed or pasted); Enter does the same.
  const changeCode = (value: string) => {
    setCode(value);
    joinWith(value.trim().toUpperCase());
  };

  const join = (event: FormEvent) => {
    event.preventDefault();
    joinWith(code.trim().toUpperCase());
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-x-12 gap-y-24 md:grid-cols-2">
      {!ranking.data && (
        <div className="flex justify-center md:col-span-2">
          <ModeButton kind={kind} onChoose={chooseKind} />
        </div>
      )}
      {/* PANEL Season: the season bar with the own rating. It is extra here: while it loads, or if it fails, the lobby works without it. */}
      {ranking.data && (
        <div className="duel-rise md:col-span-2">
          <SeasonPanel
            number={ranking.data.season.number}
            startsAt={ranking.data.season.startsAt}
            endsAt={ranking.data.season.endsAt}
            lead={
              // The mode in play, so it shows without opening the modal.
              <span data-tutorial="rank-kind" role="img" aria-label={`Mode: ${kind}`} className="flex items-center">
                {kind === 'rain' ? <CloudRain className="size-12" aria-hidden="true" /> : <Swords className="size-12" aria-hidden="true" />}
              </span>
            }
            actions={
              <>
                <ModeButton kind={kind} onChoose={chooseKind} hoverOnly />
                <LeaderboardLink />
              </>
            }
            headline={
              <>
                <Trophy className="size-6" aria-hidden="true" />
                <span>{ranking.data.tier}</span>
              </>
            }
            subline={`${ranking.data.wins}W · ${ranking.data.losses}L · ${ranking.data.draws}D`}
            value={ranking.data.rating}
            valueLabel="Your rating"
          />
        </div>
      )}
      {/* PANEL Duel a friend: create a room of the chosen mode. */}
      <div className={hoverFrame}>
        <Panel title="Duel a friend" bare centerTitle titleClassName={titleClass} titleTip={KIND_TIPS[kind]} fill className="justify-end">
          <PanelArt icon={kind === 'rain' ? CloudRain : Swords} />
          <Button disabled={pending} onClick={() => createMatch.mutate(kind, { onSuccess: (match) => onEnter(match.code) })}>
            <Swords className="size-4" aria-hidden="true" />
            Create room
          </Button>
        </Panel>
      </div>
      {/* PANEL Join a room: type the code of a friend's room. */}
      <div className={hoverFrame}>
        <Panel title="Join a room" bare centerTitle titleClassName={titleClass} titleTip="Type the 6-character code of a friend's room to join their duel." fill>
          <PanelArt icon={DoorOpen} />
          <form onSubmit={join} className="flex flex-col gap-3">
            <Input
              aria-label="Room code"
              value={code}
              onChange={(event) => changeCode(event.target.value)}
              maxLength={ROOM_CODE_LENGTH}
              autoComplete="off"
              placeholder="ABC234"
              className="text-center text-2xl uppercase tracking-[0.3em]"
            />
          </form>
        </Panel>
      </div>
    </div>
  );
};
