import { useState, type FormEvent } from 'react';
import { CloudRain, DoorOpen, ListOrdered, Swords, Trophy, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Panel } from '@/shared/components/panel';
import { TabGroup } from '@/shared/components/tab-group';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { MONTHS } from '@/shared/lib/local-date';
import { useCreateMatch, useJoinMatch } from '../hooks/use-match';
import { useRankedMe } from '../hooks/use-ranked';
import type { MatchKind, SeasonInfo } from '../types/ranked.types';

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

/** The days a season runs, e.g. `{ from: '1 Oct 2026', to: '31 Dec 2026' }`; `undefined` when the dates are missing. */
const seasonDays = ({ startsAt, endsAt }: SeasonInfo) => {
  const [start, end] = [new Date(startsAt), new Date(endsAt)];
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
  const day = (date: Date) => `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  return { from: day(start), to: day(end) };
};

/** No room yet: the kind of match (Race or Rain), the own season rating of that kind, then create a room of that kind (the code is shared with a friend) or join one with its code. */
export const RankLobby = ({ onEnter }: { onEnter: (code: string) => void }) => {
  const createMatch = useCreateMatch();
  const joinMatch = useJoinMatch();
  const [kind, setKind] = useState<MatchKind>(lastKind);
  const ranking = useRankedMe(kind);
  const days = ranking.data && seasonDays(ranking.data.season);
  const [code, setCode] = useState('');
  const pending = createMatch.isPending || joinMatch.isPending;

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
      <div data-tutorial="rank-kind" className="flex justify-center md:col-span-2">
        <TabGroup
          label="Kind of match"
          tabs={KINDS}
          value={kind}
          onChange={(value) => {
            setKind(value as MatchKind);
            rememberKind(value as MatchKind);
          }}
        />
      </div>
      {/* The own rating is extra here: while it loads, or if it fails, the lobby works without it. */}
      {ranking.data && (
        <div className="duel-rise group md:col-span-2">
          <Panel className="flex items-center gap-6 text-primary">
            <div className="mr-auto flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-[3.25rem] font-black uppercase leading-none">Season {ranking.data.season.number}</span>
              {/* 2.3rem = the height of the capitals of SEASON (0.7 of its 3.25rem), so FROM sits at their top and TO on their baseline. */}
              {days && (
                <div className="flex h-[2.3rem] flex-col items-start justify-between text-base leading-none text-muted-foreground">
                  <span>FROM {days.from}</span>
                  <span>TO {days.to}</span>
                </div>
              )}
              {/* Shows while the bar is hovered or holds the focus (always on touch screens, which cannot hover). */}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/leaderboard"
                      aria-label="Leaderboard"
                      className="flex size-[2.3rem] shrink-0 items-center justify-center text-primary opacity-0 transition hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
                    >
                      <ListOrdered className="size-6" aria-hidden="true" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Leaderboard</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="flex items-center gap-2 text-2xl font-semibold leading-none">
                <Trophy className="size-6" aria-hidden="true" />
                <span>{ranking.data.tier}</span>
              </span>
              <span className="text-xl leading-none text-muted-foreground tabular-nums">
                {ranking.data.wins}W · {ranking.data.losses}L · {ranking.data.draws}D
              </span>
            </div>
            <span className="text-[3.25rem] font-black leading-none tabular-nums" aria-label="Your rating">
              {ranking.data.rating}
            </span>
          </Panel>
        </div>
      )}
      <div className={hoverFrame}>
        <Panel title="Duel a friend" bare centerTitle titleClassName={titleClass} titleTip={KIND_TIPS[kind]} fill className="justify-end">
          <PanelArt icon={kind === 'rain' ? CloudRain : Swords} />
          <Button disabled={pending} onClick={() => createMatch.mutate(kind, { onSuccess: (match) => onEnter(match.code) })}>
            <Swords className="size-4" aria-hidden="true" />
            Create room
          </Button>
        </Panel>
      </div>
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
