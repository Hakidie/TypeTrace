import { useState, type FormEvent } from 'react';
import { Swords, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useCreateMatch, useJoinMatch } from '../hooks/use-match';
import { useRankedMe } from '../hooks/use-ranked';

/** No room yet: the own season rating on top, then create a room (the code is shared with a friend) or join one with its code. */
export const RankLobby = ({ onEnter }: { onEnter: (code: string) => void }) => {
  const createMatch = useCreateMatch();
  const joinMatch = useJoinMatch();
  const ranking = useRankedMe();
  const [code, setCode] = useState('');
  const pending = createMatch.isPending || joinMatch.isPending;

  const join = (event: FormEvent) => {
    event.preventDefault();
    const typed = code.trim().toUpperCase();
    if (typed) joinMatch.mutate(typed, { onSuccess: (match) => onEnter(match.code) });
  };

  return (
    <div className="mx-auto my-auto grid w-full max-w-3xl gap-4 md:grid-cols-2">
      {/* The own rating is extra here: while it loads, or if it fails, the lobby works without it. */}
      {ranking.data && (
        <div className="duel-rise flex flex-wrap items-end gap-x-6 gap-y-2 border bg-card/60 px-6 py-4 text-primary backdrop-blur-sm md:col-span-2">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Season {ranking.data.season.number}</span>
            <span className="flex items-center gap-2 text-xl font-semibold">
              <Trophy className="size-5" aria-hidden="true" />
              <span>{ranking.data.tier}</span>
            </span>
          </div>
          <span className="text-5xl font-black leading-none tabular-nums" aria-label="Your rating">
            {ranking.data.rating}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {ranking.data.wins}W · {ranking.data.losses}L · {ranking.data.draws}D
          </span>
          <Link to="/leaderboard" className="ml-auto text-sm font-semibold underline-offset-4 hover:underline">
            Leaderboard
          </Link>
        </div>
      )}
      <Panel title="Duel a friend" description="Open a room and share its code. You both type the same English passage." fill className="justify-end">
        <Button disabled={pending} onClick={() => createMatch.mutate(undefined, { onSuccess: (match) => onEnter(match.code) })}>
          <Swords className="size-4" aria-hidden="true" />
          Create room
        </Button>
      </Panel>
      <Panel title="Join a room" fill>
        <form onSubmit={join} className="flex flex-col gap-3">
          <label htmlFor="room-code" className="text-muted-foreground">
            Room code
          </label>
          <Input
            id="room-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            maxLength={6}
            autoComplete="off"
            placeholder="ABC234"
            className="text-center text-2xl uppercase tracking-[0.3em]"
          />
          <Button type="submit" disabled={pending || code.trim().length !== 6}>
            Join
          </Button>
        </form>
      </Panel>
    </div>
  );
};
